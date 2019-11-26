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

    var page = 0;
    var moredata = true;

    //while(moredata) {
      const initialQuery = "SELECT Name, Id FROM %name-space%CalculationMatrixRow__c WHERE %name-space%CalculationMatrixVersionId__c = '" + matrixid + "'  LIMIT 9000 OFFSET "  + page;
      var query = AppUtils.replaceaNameSpace(initialQuery);
      deleteCalMatrix.deletePage(query,conn);
    //} 
  }

  static deletePage(initialQuery,conn) {
    conn.bulk.query(initialQuery)
      .on('record', function(result) { 
        //console.log('/////QUERY: ' +queryString2)
        //var elementPropertySet = result;
      })
      .on("queue", function(batchInfo) {
        AppUtils.log3('Waiting for Batch');
      })
      .on("end", function(result) {
        console.log('Resiult:' + result);
      })
      .on('error', function(err) { 
        console.error(err); 
      })
    }


}
