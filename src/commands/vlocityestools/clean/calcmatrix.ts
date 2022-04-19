import { flags, SfdxCommand } from '@salesforce/command';
import { Messages, SfdxError} from '@salesforce/core';
import { AppUtils } from '../../../utils/AppUtils';
import { DBUtils } from '../../../utils/DBUtils';

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
    matrixid: flags.string({char: 'i', description: messages.getMessage('numberRecentVersions'), required: true}),
    package: flags.string({char: 'p', description: messages.getMessage('packageType')}),
    hard: flags.boolean({char: 'h', description: messages.getMessage('hard')})
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
    var hard = this.flags.hard;

    const conn = this.org.getConnection();

    AppUtils.ux = this.ux;

    var nameSpaceSet = await AppUtils.setNameSpace(conn,packageType);
    //console.log('nameSpaceSet: ' + nameSpaceSet);
    if(!nameSpaceSet){
      throw new SfdxError("Error: Package was not set or incorrect was provided.");
    }
    
    AppUtils.logInitial(messages.getMessage('command'));  

    const initialQuery = "SELECT Id FROM %name-space%CalculationMatrixRow__c WHERE %name-space%CalculationMatrixVersionId__c = '" + matrixid + "'";
    var query = AppUtils.replaceaNameSpace(initialQuery);
    console.log(query);
    await this.deleteMatrixAndRows(query,conn,matrixid,hard);
  }

  async updateOldCalMatrixVersion(matrixid,conn) {
    AppUtils.log3('Updating Matrix Version with Dummny Data to be delete later');
    //var initialQuery = "SELECT Id, Name, %name-space%CalculationMatrixId__c, %name-space%EndDateTime__c, %name-space%StartDateTime__c, %name-space%Priority__c, %name-space%VersionNumber__c FROM %name-space%CalculationMatrixVersion__c WHERE ID = '" + matrixid + "' LIMIT 1";
    var initialQuery = "SELECT Id, Name, %name-space%CalculationMatrixId__c FROM %name-space%CalculationMatrixVersion__c WHERE ID = '" + matrixid + "' LIMIT 1";
    var query = AppUtils.replaceaNameSpace(initialQuery);
    var result = await conn.query(query);
    var mainMatrixID = await result.records[0][AppUtils.replaceaNameSpace('%name-space%CalculationMatrixId__c')];

    var initialQueryForAllVersions = "SELECT Id, Name FROM %name-space%CalculationMatrixVersion__c WHERE %name-space%CalculationMatrixId__c = '" + mainMatrixID + "'";
    var queryForAllVersions = AppUtils.replaceaNameSpace(initialQueryForAllVersions);
    const result2 = await conn.query(queryForAllVersions);
    var numOfTodelte = result2.records.
    length;

    await conn.sobject(AppUtils.replaceaNameSpace('%name-space%CalculationMatrixVersion__c')).update({ 
      Id : matrixid,
      Name : 'TO_DELETE_' + result.records[0].Name,
      [AppUtils.replaceaNameSpace('%name-space%EndDateTime__c')] : '2200-12-30T13:39:00.000+0000',
      [AppUtils.replaceaNameSpace('%name-space%StartDateTime__c')] : '2200-01-30T13:39:00.000+0000',
      [AppUtils.replaceaNameSpace('%name-space%Priority__c')] : 1000 + numOfTodelte + '',
      [AppUtils.replaceaNameSpace('%name-space%VersionNumber__c')] : 1000 + numOfTodelte + ''
    }, function(err, ret) {
      if (err) {
        AppUtils.log3('Error Updating Version: ' + err);
      }
      else {
        AppUtils.log3('Matrix Version Updated Succesfully');
        AppUtils.log3("Please wait 24 Hours to delete Matrix versions with the tag 'TO_DELETE_'");
      }
    });

  }


   async deleteMatrixAndRows(initialQuery,conn,matrixid,hard) {
    AppUtils.log3('Fetching All Row records...');
    var records = await DBUtils.bulkAPIquery(conn, initialQuery) 
    if (records.length > 0){
      AppUtils.log3('Succesfully Fetched All Row records... Number of records: ' + records.length);
      DBUtils.bulkAPIdelete(records,conn,AppUtils.replaceaNameSpace("%name-space%CalculationMatrixRow__c"),false,hard,null,null)
      this.updateOldCalMatrixVersion(matrixid,conn);
    }
    else {
      AppUtils.log3('No Rows where found for Matrix version with ID: ' + matrixid );
      this.updateOldCalMatrixVersion(matrixid,conn);
    }
  }
  


}
