import { flags, SfdxCommand } from '@salesforce/command';
import { Messages, SfdxError } from '@salesforce/core';
import { AppUtils } from '../../../utils/AppUtils';

// Initialize Messages with the current plugin directory
Messages.importMessagesDirectory(__dirname);

const yaml = require('js-yaml');
const fsExtra = require("fs-extra");

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = Messages.loadMessages('vlocityestools', 'objects');

export default class cleanObjects extends SfdxCommand {

  public static description = messages.getMessage('commandDescription');

  public static examples = [
  `$ sfdx vlocityestools:clean:objects -u myOrg@example.com -p ins -d objects.yaml
  `,
  `$ sfdx vlocityestools:clean:objects --targetusername myOrg@example.com --dataFile objects.yaml
  `
  ];

  public static args = [{name: 'file'}];

  private static batchSize = 10000;

  private static error = false;

  protected static flagsConfig = {
    package: flags.string({char: 'p', description: messages.getMessage('packageType')}),
    datafile: flags.string({char: 'd', description: messages.getMessage('dataFile')}),
    onlyquery: flags.string({char: 'q', description: messages.getMessage('onlyquery')}),
    retry: flags.string({char: 'r', description: messages.getMessage('retry')}),
    save: flags.string({char: 's', description: messages.getMessage('save')})
  };

  // Comment this out if your command does not require an org username
  protected static requiresUsername = true;

  // Comment this out if your command does not support a hub org username
  //protected static supportsDevhubUsername = true;

  // Set this to true if your command requires a project workspace; 'requiresProject' is false by default
  //protected static requiresProject = false;

  public async run() {

    var packageType = this.flags.package;
    var onlyquery = this.flags.onlyquery;
    var retry = this.flags.retry;
    var save = this.flags.save;

    AppUtils.ux = this.ux;
    AppUtils.logInitial(messages.getMessage('command')); 

    const conn = this.org.getConnection();
    var nameSpaceSet = await AppUtils.setNameSpace(conn,packageType);
    //console.log('nameSpaceSet: ' + nameSpaceSet);
    if(!nameSpaceSet){
      throw new SfdxError("Error: Package was not set or incorrect was provided.");
    }
    //console.log('onlyquery: ' + onlyquery);
    
    var dataFile = this.flags.datafile;

    if (!fsExtra.existsSync(dataFile)) {
      throw new Error("Error: File: " + dataFile + " does not exist");
    }

    var doc = yaml.safeLoad(fsExtra.readFileSync(dataFile, 'utf8'));

    do {
      AppUtils.log3('Deleting....');
      console.log('');
      for (let index = 0; index < Object.keys(doc.Objects).length; index++) {
        var element = Object.keys(doc.Objects)[index];
        var where = doc.Objects[element] != null? doc.Objects[element] : undefined;
        var objectAPIName = AppUtils.replaceaNameSpaceFromFile(element);
        AppUtils.log3('Object: ' + objectAPIName);
        try {
          await cleanObjects.deleteRecordsFromObject(objectAPIName,conn,onlyquery,where,save);
        } catch (error) {
          AppUtils.log2('Error Deleting: '  + objectAPIName + '  Error: ' + error);
        }
      }
      console.log('');
    } while (retry && cleanObjects.error);
    AppUtils.log3('All Done');
  }

  static async deleteRecordsFromObject(objectName,conn,onlyquery,where,save) {
    var query = 'SELECT Id FROM ' + objectName 
    if(where){
      query += ' WHERE ' + where;  
      AppUtils.log2('SOQL:  ' + query);  
      AppUtils.startSpinner('Fetching records for ' + objectName );
    } else {
      AppUtils.startSpinner('Fetching All records for ' + objectName );
    }
    var count = 0;
    var records = [];
    let promise = new Promise((resolve, reject) => {
      conn.bulk.query(query)
        .on('record', function(result) { 
          records.push(result);
          count++;
          AppUtils.updateSpinnerMessage('Objects Fetched so far: ' + count);
        })
        .on("queue", function(batchInfo) {
          AppUtils.log3('Fetch queued');
          AppUtils.updateSpinnerMessage('Fetch queued');
        })
        .on("end", function() {
          if (records.length > 0){
            AppUtils.stopSpinnerMessage('Succesfully Fetched All Row records... Number of records: ' + records.length);
            resolve('Done');
          }
          else {
            AppUtils.stopSpinnerMessage('No Rows where found for: ' + objectName);
            resolve('No');
          }
        })
        .on('error', function(err) {
          AppUtils.stopSpinnerMessage('Error Fetching: ' + err)
          resolve(err);
        });
    });
    var value = await promise;
    //console.log('value: ' + value);
    if(value == 'Done' && !onlyquery){
      //console.log(JSON.stringify(records));
      await cleanObjects.deleteRows(records,conn,objectName,save);
    }
  }
  

  static async deleteRows(records,conn,objectName,save) {
    var job = conn.bulk.createJob(objectName,'hardDelete');
    //job.open();
    //console.log(job);
    var numOfComonents = records.length;
    var numberOfBatches = Math.floor(numOfComonents/this.batchSize) + 1
    var numberOfBatchesDone = 0;
    AppUtils.log2('Number Of Batches to be created to delete Rows: ' + numberOfBatches);
    var promises = [];
    for (var i=0; i<numberOfBatches; i++) {
      var batchNumber = i + 1;
      var arraytoDelete = records;
      if(i<(numberOfBatches-1)) {
        arraytoDelete = records.splice(0,this.batchSize);
      }
      var batch = job.createBatch();
      var batchNumber = i + 1;
      //console.log(batch);
      AppUtils.log1('Creating Batch # ' + batchNumber + ' Number of Records: ' + arraytoDelete.length);
      let newp = new Promise( (resolve, reject) => {
        batch.execute(arraytoDelete)
        .on("error",  function(err) { 
          console.log('Error, batch # ' + batchNumber + 'Info:', err);
          numberOfBatchesDone = numberOfBatchesDone +1;
          resolve();
        })
        .on("queue",  function(batchInfo) { 
          AppUtils.log1('Waiting for batch # ' + batchNumber + ' to finish');
          batch.poll(1000 /* interval(ms) */, 600000 /* timeout(ms) */); 
        })
        .on("response",  function(rets) { 
          numberOfBatchesDone = numberOfBatchesDone +1;
          var hadErrors = cleanObjects.noErrors(rets);
          AppUtils.log1('Batch # ' + batchNumber + ' Id: ' + batch.id + ' Finished - Success: ' + hadErrors + '  '+ numberOfBatchesDone + '/' + numberOfBatches + ' Batches have finished');
          if(save){
            cleanObjects.saveResults(rets,batchNumber,objectName);
          }
          resolve();
        });
        //console.log('batch: '+ batch);
      });
      promises.push(newp);
      //console.log('newp: ' + JSON.stringify(newp));
    }
    await Promise.all(promises);
    job.close();
  }

  private static saveResults(rets,batchNumber,objectName) {
    var fileName = 'Results_' + objectName + '_' + batchNumber + '.json';
    if (fsExtra.existsSync(fileName)) {
      fsExtra.unlinkSync(fileName);
    }
    const createFiles = fsExtra.createWriteStream(fileName, {flags: 'a'});
    createFiles.write(JSON.stringify(rets));  
    AppUtils.log1('File Created: ' + fileName); 
  }

  private static noErrors(rets){
    for (let index = 0; index < rets.length; index++) {
      const element = rets[index];
      if(!element.success){
        return false;
      }
    }
    return true;
  }

}
