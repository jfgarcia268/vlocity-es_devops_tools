import { flags, SfdxCommand } from '@salesforce/command';
import { Messages } from '@salesforce/core';
import { AppUtils } from '../../../utils/AppUtils';
import { DBUtils } from '../../../utils/DBUtils';

// Initialize Messages with the current plugin directory
Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = Messages.loadMessages('vlocityestools', 'updatefield');

export default class updatefield extends SfdxCommand {

  public static description = messages.getMessage('commandDescription');

  public static examples = [
  `$ sfdx vlocityestools:data:updatefield -u myOrg@example.com -o Product2 -f IsActive -v true
  `,
  `$ sfdx vlocityestools:data:updatefield --targetusername --object Product2 --field IsActive --value false --where "ProductCode LIKE 'VLO%'"
  `
  ];

  public static args = [{name: 'file'}];

  protected static flagsConfig = {
    object: flags.string({char: 'o', description: messages.getMessage('object'), required: true}),
    field: flags.string({char: 'f', description: messages.getMessage('field'), required: true}),
    value: flags.string({char: 'v', description: messages.getMessage('value'), required: true}),
    where: flags.string({char: 'w', description: messages.getMessage('where'), required: false}),
  };

  // Comment this out if your command does not require an org username
  protected static requiresUsername = true;

  // Comment this out if your command does not support a hub org username
  //protected static supportsDevhubUsername = true;

  // Set this to true if your command requires a project workspace; 'requiresProject' is false by default
  //protected static requiresProject = false;

  public async run() {

    var object = this.flags.object;
    var field = this.flags.field;
    var value = this.flags.value;
    var where = this.flags.where;

    AppUtils.ux = this.ux;
    AppUtils.logInitial(messages.getMessage('command')); 

    const conn = this.org.getConnection();  
    
    var query = "SELECT Id, " + field + " FROM " + object
    if(where){
      query += " WHERE " + where
    }
    
    AppUtils.log4('Exporting Data...');
    AppUtils.log3('Query: ' + query);
    var records = await DBUtils.bulkAPIquery(conn, query);
    //console.log(records);
    //console.log(records.length);
    if(records.length == 0){
      AppUtils.log3('No Records to Update');
    } else {
      AppUtils.log4('Updating Data Locally...');
      AppUtils.log3('Number Of records to Update: ' + records.length);
      for (let i = 0; i < records.length; i++) {
        records[i][field] = value;
        //console.log(records[i]);
      }
      AppUtils.log4('Updating Data...');
      await DBUtils.bulkAPIUpdate(records,conn,object) ;
    }
  }
  
}
