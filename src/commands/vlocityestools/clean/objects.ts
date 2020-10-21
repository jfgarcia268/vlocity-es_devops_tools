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
  //private static batchSize = 10; //Testing

  private static bulkApiPollTimeout = 60;

  private static error = false;

  protected static flagsConfig = {
    package: flags.string({char: 'p', description: messages.getMessage('packageType')}),
    datafile: flags.string({char: 'd', description: messages.getMessage('dataFile')}),
    onlyquery: flags.string({char: 'q', description: messages.getMessage('onlyquery')}),
    retry: flags.string({char: 'r', description: messages.getMessage('retry')}),
    save: flags.string({char: 's', description: messages.getMessage('save')}),
    hard: flags.string({char: 'h', description: messages.getMessage('hard')}),
    polltimeout: flags.string({char: 't', description: messages.getMessage('polltimeout')}),
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
    var hard = this.flags.hard;
    var polltimeout = this.flags.polltimeout;

    if(polltimeout){
      cleanObjects.bulkApiPollTimeout = polltimeout;
    }

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

    var resultData = [];

    do {
      AppUtils.log3('Deleting....');
      console.log('');
      for (let index = 0; index < Object.keys(doc.Objects).length; index++) {
        var element = Object.keys(doc.Objects)[index];
        var where = doc.Objects[element] != null? doc.Objects[element] : undefined;
        var objectAPIName = AppUtils.replaceaNameSpaceFromFile(element);
        AppUtils.log3('Object: ' + objectAPIName);
        try {
          await cleanObjects.deleteRecordsFromObject(objectAPIName,conn,onlyquery,where,save,hard,resultData);
        } catch (error) {
          AppUtils.log2('Error Deleting: '  + objectAPIName + '  Error: ' + error);
        }
      }
      console.log('');
    } while (retry && cleanObjects.error);

    var tableColumnData = ['ObjectName', 'RecordsFound', 'DeleteSuccess']; 
    AppUtils.ux.log('RESULTS:');
    //AppUtils.ux.log(' ');
    AppUtils.ux.table(resultData, tableColumnData);
    AppUtils.ux.log(' ');
  }

  static async deleteRecordsFromObject(objectName,conn,onlyquery,where,save,hard,resultData) {
    var query = 'SELECT Id FROM ' + objectName 
    if(where){
      query += ' WHERE ' + where;  
      AppUtils.log2('SOQL:  ' + query);  
      AppUtils.startSpinner('Fetching records for ' + objectName );
    } else {
      AppUtils.startSpinner('Fetching All records for ' + objectName );
    }

    //Testing
    //query += ' LIMIT 200';
    //

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
      await cleanObjects.deleteRows(records,conn,objectName,save,hard,resultData);
    } else {
      resultData.push({ ObjectName: objectName , RecordsFound: records.length , DeleteSuccess: 'N/A'});
    }
  }
  

  static async deleteRows(records,conn,objectName,save,hardelete,resultData) {
    var deleteType = hardelete == true ? 'hardDelete' : 'Delete';
    var job = await conn.bulk.createJob(objectName,deleteType);
    await job.open();
    //console.log(job);
    var numOfComonents = records.length;
    var div = numOfComonents/this.batchSize;
    var numberOfBatches = Math.floor(div) == div ? div : Math.floor(div)  + 1;
    var numberOfBatchesDone = 0;
    AppUtils.log2('Number Of Batches to be created to delete Rows: ' + numberOfBatches);
    try {
      var promises = [];
      for (var i=0; i<numberOfBatches; i++) {
        
        var arraytoDelete = records;
        if(i<(numberOfBatches-1)) {
          arraytoDelete = records.splice(0,this.batchSize);
        }
        let newp = new Promise((resolve, reject) => {
          var batchNumber = i + 1;
          var batch = job.createBatch()
          AppUtils.log1('Creating Batch # ' + batchNumber + ' Number of Records: ' + arraytoDelete.length);

          //console.log('Enter Promise');
          batch.execute(arraytoDelete)
          .on("error",  function(err) { 
            console.log('Error, batch Info:', err);
            numberOfBatchesDone = numberOfBatchesDone +1;
            resultData.push({ ObjectName: objectName , RecordsFound: records.length , DeleteSuccess: 'No Error: ' + err});
            resolve();
          })
          .on("queue",  function(batchInfo) { 
            batch.poll(5*1000 /* interval(ms) */, 1000*60*cleanObjects.bulkApiPollTimeout /* timeout(ms) */);
            AppUtils.log1('Batch #' + batchNumber +' with Id: ' + batch.id + ' Has started');
          })
          .on("response",  function(rets) { 
            numberOfBatchesDone = numberOfBatchesDone +1;
            var hadErrors = cleanObjects.noErrors(rets);
            //console.log(rets);
            AppUtils.log1('Batch #' + batchNumber + ' With Id: ' + batch.id + ' Finished - Success: ' + hadErrors + '  '+ numberOfBatchesDone + '/' + numberOfBatches + ' Batches have finished');
            resultData.push({ ObjectName: objectName , RecordsFound: records.length , DeleteSuccess: hadErrors});
            if(save){
              cleanObjects.saveResults(rets,batchNumber,objectName);
            }
            resolve();
          });
          //console.log('batch: '+ batch);
        }).catch(error => {
          AppUtils.log2('Error Creating  batches - Error: ' + error);
          resultData.push({ ObjectName: objectName , RecordsFound: records.length , DeleteSuccess: 'No Error: ' + error});
        });
        await promises.push(newp);
      }
      //console.log('Promise Size: '+ Promise.length);
      await Promise.all(promises);
      job.close();
    } catch (error) {
      job.close();
      AppUtils.log2('Error Creating  batches - Error: ' + error);
      resultData.push({ ObjectName: objectName , RecordsFound: records.length , DeleteSuccess: 'No Error: ' + error});
    }
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
