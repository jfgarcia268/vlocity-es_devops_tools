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


    const initialQuery = "SELECT Name, Id FROM %name-space%CalculationMatrixRow__c WHERE %name-space%CalculationMatrixVersionId__c = '" + matrixid + "'" // LIMIT 9000 OFFSET "  + page;
    var query = AppUtils.replaceaNameSpace(initialQuery);
    deleteCalMatrix.deleteRecords(query,conn);
  }

  static deleteRecords(initialQuery,conn) {
    AppUtils.log3('Fetching All records... This may take a while');
    var records = [];
    conn.bulk.query(initialQuery)
      .on('record', function(result) { 
        records.push(result);
      })
      .on("queue", function(batchInfo) {
        console.log('Fetch queued');
      })
      .on("end", function() {
        console.log('End fethcin');
        deleteCalMatrix.delete(records,conn)
      })
      .on('error', function(err) {
        console.log('Error Fetching: ' + err); 
      })
  }
  

  static delete(records,conn) {
    var numOfComonents = records.length;
    var numberOfBatches = Math.floor(numOfComonents/9000) + 1
    AppUtils.log2('Nmber Of Batches to be created: ' + numberOfBatches);

    for (var i=0; i<numberOfBatches; i++) {
      if(i<(numberOfBatches-1)) {
        var newArray = records.splice(0,9000);
        deleteCalMatrix.deleteBatch(newArray,conn,i+1);
        //console.log('newArray.length: ' + newArray.length + ' ' + newArray[0]['Name']);
      }
      else {
        //console.log('last records.length: ' + records.length + ' ' + records[0]['Name']);
        deleteCalMatrix.deleteBatch(records,conn,i+1);
      }
  
    }
  }

  static deleteBatch(newArray,conn,batchNumber) {

    var job = conn.bulk.createJob(AppUtils.replaceaNameSpace("%name-space%CalculationMatrixRow__c"), "hardDelete");
    var batch = job.createBatch();
    AppUtils.log2('Creating Batch #: ' + batchNumber );
    batch.execute(newArray);
    batch.on("error", function(err) { // fired when batch request is queued in server.
      console.log('Error, batch #: ' + batchNumber + 'Info:', err);
    });
    batch.on("queue", function(batchInfo) { // fired when batch request is queued in server.
      AppUtils.log2('Waiting for batch #: ' + batchNumber + ' to finish');
      batch.poll(1000 /* interval(ms) */, 60000 /* timeout(ms) */); // start polling - Do not poll until the batch has started
    });
    batch.on("end", function() { // fired when batch finished and result retrieved
      AppUtils.log2('Batch #: ' + batchNumber + ' Finished');
    });
  
  }

}
