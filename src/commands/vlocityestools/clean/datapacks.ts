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

    AppUtils.ux = this.ux;
    AppUtils.logInitial(messages.getMessage("command"));
    AppUtils.ux.log(' ');

    const conn = this.org.getConnection();

    var packageType = this.flags.package;

    var nameSpaceSet = await AppUtils.setNameSpace(conn,packageType);
    //console.log('nameSpaceSet: ' + nameSpaceSet);
    if(!nameSpaceSet){
      throw new Error("Error: Package was not set or incorrect was provided.");
    }
    
      // this.org is guaranteed because requiresUsername=true, as opposed to supportsUsername
    
    const dataPacksQueryInitial = 'SELECT Id FROM %name-space%VlocityDataPack__c WHERE IsDeleted = false ';
    const dataPacksAttachmentsQueryInitial  = 'SELECT id FROM attachment '
                                                    + 'WHERE ParentId in '
                                                    + '(SELECT Id '
                                                    + 'FROM %name-space%VlocityDataPack__c ) ';

    const dataPacksQuery = AppUtils.replaceaNameSpace(dataPacksQueryInitial);
    const dataPacksAttachmentsQuery = AppUtils.replaceaNameSpace(dataPacksAttachmentsQueryInitial);
  
    // Delete Attachmets
    const resultDataPacksAttachments = await DBUtils.bulkAPIquery(conn, dataPacksAttachmentsQuery);
    if ( !resultDataPacksAttachments || resultDataPacksAttachments.length == 0) {
      AppUtils.log2("No Attachments to delete");
    } else {
      await DBUtils.bulkAPIdelete(resultDataPacksAttachments ,conn,AppUtils.replaceaNameSpace("Attachment"),false,false,undefined,60);
    } 

    // Delete Old Saved OmniScripts
    const resultDataPacks = await DBUtils.bulkAPIquery(conn, dataPacksQuery);
    if (resultDataPacks == undefined || resultDataPacks.length <= 0) {
      AppUtils.log2("No DataPacks Found to delete");
    }
    else {
      await DBUtils.bulkAPIdelete(resultDataPacks ,conn,AppUtils.replaceaNameSpace("%name-space%VlocityDataPack__c"),false,false,undefined,60);
    }
  }

}
