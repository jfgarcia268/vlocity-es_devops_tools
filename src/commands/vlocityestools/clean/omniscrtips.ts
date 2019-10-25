import { flags, SfdxCommand } from '@salesforce/command';
import { Messages, SfdxError } from '@salesforce/core';
import { AnyJson } from '@salesforce/ts-types';
import { AppUtils } from '../../../utils/AppUtils';

// Initialize Messages with the current plugin directory
Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = Messages.loadMessages('vlocityestools', 'oldomniscripts');

export default class deleteOldOS extends SfdxCommand {

  public static description = messages.getMessage('commandDescription');

  public static examples = [
  `$ sfdx vlocityestools:clean:omniscrtips -u myOrg@example.com -n 5 -p cmt
  `,
  `$ sfdx vlocityestools:clean:omniscrtips --targetusername myOrg@example.com --numberversions 5 --package ins
  `
  ];

  public static args = [{name: 'file'}];

  protected static flagsConfig = {
    numberversions: flags.integer({char: 'n', description: messages.getMessage('numberRecentVersions')}),
    package: flags.string({char: 'p', description: messages.getMessage('packageType')})
  };

  // Comment this out if your command does not require an org username
  protected static requiresUsername = true;

  // Comment this out if your command does not support a hub org username
  //protected static supportsDevhubUsername = true;

  // Set this to true if your command requires a project workspace; 'requiresProject' is false by default
  //protected static requiresProject = false;

  public async run(): Promise<AnyJson> {

    var versionsToKeep = this.flags.numberversions;
    var packageType = this.flags.package;

    if(packageType == 'cmt'){
      AppUtils.namespace = 'vlocity_cmt__';
    } else if(packageType == 'ins'){
      AppUtils.namespace = 'vlocity_ins__';
    } else {
      throw new Error("Error: -p, --package has to be either cmt or ins ");
    }
    
    AppUtils.logInitial(messages.getMessage('command'));
    AppUtils.log2('versionsToKeep: ' + versionsToKeep);

    if(versionsToKeep > 0){
      // this.org is guaranteed because requiresUsername=true, as opposed to supportsUsername
      const conn = this.org.getConnection();
      const initialQuery = 'SELECT ID, Name, %name-space%Version__c, %name-space%IsActive__c, %name-space%Language__c, %name-space%Type__c, %name-space%SubType__c FROM %name-space%OmniScript__c  Order By Name, %name-space%Language__c, %name-space%Type__c,%name-space%SubType__c, %name-space%Version__c DESC';
      const query = AppUtils.replaceaNameSpace(initialQuery);
      // Query the org
      const result = await conn.query(query);

      // The output and --json will automatically be handled for you.
      if (!result.records || result.records.length <= 0) {
        throw new SfdxError(messages.getMessage('errorNoOrgResults', [this.org.getOrgId()]));
      }


      var nameField = 'Name';
      var languageField = AppUtils.replaceaNameSpace('%name-space%Language__c');
      var typeField = AppUtils.replaceaNameSpace('%name-space%Type__c');
      var subTypeField = AppUtils.replaceaNameSpace('%name-space%SubType__c');
      var isActiveField  = AppUtils.replaceaNameSpace('%name-space%IsActive__c');
      var versionField  = AppUtils.replaceaNameSpace('%name-space%Version__c');

      var firstresult = result.records[0]
      var currentComp = firstresult[nameField] + firstresult[languageField] + firstresult[typeField] + firstresult[subTypeField];

      var count = 0;

      var OStoDetele = new Array();

      AppUtils.log2('The Following OmniScritps will be deteled:');

      for (var i=0; i<result.records.length; i++) {
        var record = result.records[i];
        var componentid = record[nameField] + record[languageField]+ record[typeField] + record[subTypeField];
        
        if(currentComp==componentid) {
          count = count + 1;
        }
        else {
          currentComp = componentid;
          count =  1;
        }

        if(count > versionsToKeep && !record[isActiveField]) {
          OStoDetele.push(record);
          var output = 'Name: ' + record[nameField] + ', Language: ' + record[languageField] + ', Type: '  + record[typeField] + ', SubType: ' + record[subTypeField] + ', Version: ' + record[versionField];
          AppUtils.log1(output);
        }
      }

      if(OStoDetele.length > 0) {
        await new Promise((resolveBatch) => {
            var job = conn.bulk.createJob("%name-space%OmniScript__c", "delete");
            var batch = job.createBatch();
            batch.execute(OStoDetele);

            batch.on("error", function(err) { // fired when batch request is queued in server.
              console.log('Error, batchInfo:', err);
              resolveBatch();
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
              resolveBatch();;
            });
        })
      } else {
        AppUtils.log2("Nothing to delete");
      }

      return { OStoDetele };

    } else {
      throw new Error("Error: -n, --numberversions has to be greated than 0");
    }
  }
}
