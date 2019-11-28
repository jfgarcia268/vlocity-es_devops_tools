import { flags, SfdxCommand } from '@salesforce/command';
import { Messages} from '@salesforce/core';
import { AppUtils } from '../../../utils/AppUtils';

// Initialize Messages with the current plugin directory
Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = Messages.loadMessages('vlocityestools', 'calcmatrix');

export default class deleteCalMatrix extends SfdxCommand {

  public static description = messages.getMessage('commandDescription');

  public static examples = [
  `$ sfdx vlocityestools:clean:calcmatrix -u myOrg@example.com -i a0dR000000kxD4qIAE -p ins
  `,
  `$ sfdx vlocityestools:clean:calcmatrix --targetusername myOrg@example.com --matrixid a0dR000000kxD4qIAE --package cmt
  `
  ];

  public static args = [{name: 'file'}];

  private static batchSize = 10000;

  protected static flagsConfig = {
    matrixid: flags.string({char: 'i', description: messages.getMessage('numberRecentVersions')}),
    package: flags.string({char: 'p', description: messages.getMessage('packageType')})
  };

  // Comment this out if your command does not require an org username
  protected static requiresUsername = true;

  // Comment this out if your command does not support a hub org username
  //protected static supportsDevhubUsername = true;

  // Set this to true if your command requires a project workspace; 'requiresProject' is false by default
  //protected static requiresProject = false;

  public async run() {

    var matrixid = this.flags.matrixid;
    var packageType = this.flags.package;

    if(packageType == 'cmt'){
      AppUtils.namespace = 'vlocity_cmt__';
    } else if(packageType == 'ins'){
      AppUtils.namespace = 'vlocity_ins__';
    } else {
      throw new Error("Error: -p, --package has to be either cmt or ins ");
    }
    
    AppUtils.logInitial(messages.getMessage('command'));  
    // this.org is guaranteed because requiresUsername=true, as opposed to supportsUsername
    const conn = this.org.getConnection();


    const initialQuery = "SELECT Name, Id FROM %name-space%CalculationMatrixRow__c WHERE %name-space%CalculationMatrixVersionId__c = '" + matrixid + "'";
    var query = AppUtils.replaceaNameSpace(initialQuery);
    deleteCalMatrix.deleteMatrixAndRows(query,conn,matrixid);
  }

  static async deleteCalMatrixVersion(matrixid,conn) {
    var initialQuery = "SELECT Id FROM %name-space%CalculationMatrixVersion__c WHERE ID = '" + matrixid + "' LIMIT 1";
    var query = AppUtils.replaceaNameSpace(initialQuery);
    var result =  await conn.query(query);
    var job = conn.bulk.createJob(AppUtils.replaceaNameSpace('%name-space%CalculationMatrixVersion__c'),'delete');
    var batch = job.createBatch();
    AppUtils.log2('Creatin Job to delete Matrix version' );
    batch.execute(result.records)
    .on("error", function(err) { // fired when batch request is queued in server.
      console.log('Error Deteting Matrix version: ', err);
      job.close();
    })
    .on("queue", function(batchInfo) { // fired when batch request is queued in server.
      AppUtils.log1('Waiting for batch to complete');
      batch.poll(1000 /* interval(ms) */, 100000 /* timeout(ms) */); // start polling - Do not poll until the batch has started
    })
    .on("response", function(res) { // fired when batch finished and result retrieved
      AppUtils.log1('Batch Finished: ' + JSON.stringify(res.success));
      job.close();
    });

  }


  static deleteMatrixAndRows(initialQuery,conn,matrixid) {
    AppUtils.log3('Fetching All Row records... This may take a while');
    var records = [];
    conn.bulk.query(initialQuery)
      .on('record', function(result) { 
        records.push(result);
      })
      .on("queue", function(batchInfo) {
        AppUtils.log3('Fetch queued');
      })
      .on("end", function() {
        if (records.length > 0){
          AppUtils.log3('Succesfully Fetched All Row records... Number of records: ' + records.length);
          deleteCalMatrix.deleteRows(records,conn,matrixid)
        }
        else {
          AppUtils.log3('No Rows where found for Matrix version with ID: ' + matrixid );
          deleteCalMatrix.deleteCalMatrixVersion(matrixid,conn);
        }

      })
      .on('error', function(err) {
        console.log('Error Fetching: ' + err); 
      })
  }
  

  static async deleteRows(records,conn,matrixid) {
    var job = await conn.bulk.createJob(AppUtils.replaceaNameSpace("%name-space%CalculationMatrixRow__c"),'delete');
    var numOfComonents = records.length;
    var numberOfBatches = Math.floor(numOfComonents/this.batchSize) + 1
    var numberOfBatchesDone = 0;
    AppUtils.log2('Number Of Batches to be created to delete Rows: ' + numberOfBatches);
    var promises = [];
    for (var i=0; i<numberOfBatches; i++) {
      var newp = new Promise(async(resolve) => {
        AppUtils.log1('Creating Batch #: ' + i );
        var ArraytoDelete = records;
        if(i<(numberOfBatches-1)) {
          ArraytoDelete = records.splice(0,this.batchSize);
        }
        var batch = job.createBatch();
        var batchNumber = i + 1;
        batch.execute(ArraytoDelete)
        .on("error", function(err) { // fired when batch request is queued in server.
          console.log('Error, batch #: ' + batchNumber + 'Info:', err);
          numberOfBatchesDone = numberOfBatchesDone +1;
          resolve();
        })
        .on("queue", function(batchInfo) { // fired when batch request is queued in server.
          AppUtils.log1('Waiting for batch #: ' + batchNumber + ' to finish');
          batch.poll(1000 /* interval(ms) */, 600000 /* timeout(ms) */); // start polling - Do not poll until the batch has started
        })
        .on("response", function(rets) { // fired when batch finished and result retrieved
          numberOfBatchesDone = numberOfBatchesDone +1;
          AppUtils.log1('Batch #: ' + batchNumber + ' Finished - ' + numberOfBatchesDone + '/' + numberOfBatches + ' Batches have finished');
          resolve();
        });
      });
      promises.push(newp);
    }
    Promise.all(promises).then(values => {
      job.close();
      this.deleteCalMatrixVersion(matrixid,conn);
    });
  }

  

}
