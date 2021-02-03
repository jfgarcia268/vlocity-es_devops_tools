import { flags, SfdxCommand } from '@salesforce/command';
import { Messages} from '@salesforce/core';
import { AppUtils } from '../../../utils/AppUtils';
import { DBUtils } from '../../../utils/DBUtils';

// Initialize Messages with the current plugin directory
Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = Messages.loadMessages('vlocityestools', 'olddatapacks');

export default class deleteOldDataPacks extends SfdxCommand {

  public static description = messages.getMessage('commandDescription');

  public static examples = [
  `$ sfdx vlocityestools:clean:datapacks-u myOrg@example.com -p cmt
  `,
  `$ sfdx vlocityestools:clean:datapacks --targetusername myOrg@example.com --package ins
  `
  ];

  public static args = [{name: 'file'}];

  protected static flagsConfig = {
    package: flags.string({char: 'p', description: messages.getMessage('packageType')})
  };

  // Comment this out if your command does not require an org username
  protected static requiresUsername = true;

  // Comment this out if your command does not support a hub org username
  //protected static supportsDevhubUsername = true;

  // Set this to true if your command requires a project workspace; 'requiresProject' is false by default
  //protected static requiresProject = false;

  public async run(){

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
    const dataPacksQueryInitial = 'SELECT Id FROM %name-space%VlocityDataPack__c WHERE IsDeleted = false ';
    const dataPacksAttachmentsQueryInitial  = 'SELECT id FROM attachment '
                                                    + 'WHERE ParentId in '
                                                    + '(SELECT Id '
                                                    + 'FROM %name-space%VlocityDataPack__c ) ';


    const dataPacksQuery = AppUtils.replaceaNameSpace(dataPacksQueryInitial);
    const dataPacksAttachmentsQuery = AppUtils.replaceaNameSpace(dataPacksAttachmentsQueryInitial);
  
    // Delete Attachmets
    const resultDataPacksAttachments = await conn.query(dataPacksAttachmentsQuery);
    if ( !resultDataPacksAttachments || resultDataPacksAttachments.records.length == 0) {
      AppUtils.log2("No Attachments to delete");
    } else {
      await DBUtils.bulkAPIdelete(resultDataPacksAttachments.records ,conn,AppUtils.replaceaNameSpace("Attachment"),false,false,undefined,60);
    } 

    // Delete Old Saved OmniScripts
    const resultDataPacks = await conn.query(dataPacksQuery);
    if (resultDataPacks == undefined || resultDataPacks.records.length <= 0) {
      AppUtils.log2("No DataPacks Found to delete");
    }
    else {
      await DBUtils.bulkAPIdelete(resultDataPacks.records  ,conn,AppUtils.replaceaNameSpace("%name-space%VlocityDataPack__c"),false,false,undefined,60);
    }
  }

}
