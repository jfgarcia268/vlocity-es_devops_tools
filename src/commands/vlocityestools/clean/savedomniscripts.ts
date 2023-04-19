import { flags, SfdxCommand } from '@salesforce/command';
import { Messages} from '@salesforce/core';
import { AppUtils } from '../../../utils/AppUtils';

// Initialize Messages with the current plugin directory
Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = Messages.loadMessages('vlocityestools', 'oldsavedomniscripts');

export default class deleteOldSavedOS extends SfdxCommand {

  public static description = messages.getMessage('commandDescription');

  public static examples = [
  `$ sfdx vlocityestools:clean:savedomniscripts -u myOrg@example.com -p cmt
  `,
  `$ sfdx vlocityestools:clean:savedomniscripts --targetusername myOrg@example.com --package ins
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
    const savedOmniScriptsQueryInitial = 'SELECT ID from %name-space%OmniScriptInstance__c WHERE %name-space%OmniScriptVersion__c = 0';
    const savedOmniScriptsAttachmentsQueryInitial  = 'SELECT id FROM attachment '
                                                    + 'WHERE ParentId in '
                                                    + '(SELECT Id '
                                                    + 'FROM %name-space%OmniScriptInstance__c where %name-space%OmniScriptVersion__c = 0) ';


    const savedOmniScriptsQuery = AppUtils.replaceaNameSpace(savedOmniScriptsQueryInitial);
    const savedOmniScriptsAttachmentsQuery = AppUtils.replaceaNameSpace(savedOmniScriptsAttachmentsQueryInitial);
    
    
    
    // Delete Attachmets
    const resultSavedOmniAttachments = await conn.query(savedOmniScriptsAttachmentsQuery);
    if (resultSavedOmniAttachments == undefined || resultSavedOmniAttachments.records.length <= 0) {
      AppUtils.log2("No Attachments to delete");

    } else {
      deleteOldSavedOS.deleteRecords(conn, AppUtils.replaceaNameSpace("attachment"),resultSavedOmniAttachments.records );
    } 

    // Delete Old Saved OmniScripts
    const resultSavedOmniScripts = await conn.query(savedOmniScriptsQuery);
    if (resultSavedOmniScripts == undefined || resultSavedOmniScripts.records.length <= 0) {
      AppUtils.log2("No Saved OmniScripts Found to delete");
    }
    else {
      deleteOldSavedOS.deleteRecords(conn, AppUtils.replaceaNameSpace("%name-space%OmniScriptInstance__c"),resultSavedOmniScripts.records );
    }
  }

  static deleteRecords(conn,type,recordsToDelete){
    new Promise((resolveBatch) => {
      var job = conn.bulk.createJob(type, "delete");
      var batch = job.createBatch();
      batch.execute(recordsToDelete);

      batch.on("error", function(err) { // fired when batch request is queued in server.
        console.log('Error, batchInfo:', err);
        resolveBatch(err);
      });
      batch.on("queue", function(batchInfo) { // fired when batch request is queued in server.
        AppUtils.log2('Waiting for batch to finish');
        batch.poll(1000 /* interval(ms) */, 20000 /* timeout(ms) */); // start polling - Do not poll until the batch has started
      });
      batch.on("response", function(rets) { // fired when batch finished and result retrieved
        for (var i=0; i < rets.length; i++) {
          //AppUtils.log3(JSON.stringify(rets[i]));
          if (rets[i].success) {
            AppUtils.log1("#" + (i+1) + " Delete successfully: " + rets[i].id);
          } else {
            AppUtils.log1("#" + (i+1) + " Error occurred, message = " + rets[i].errors.join(', '));
          }
        }
        resolveBatch(rets);;
      });
  })

  }


}
