import { flags, SfdxCommand } from '@salesforce/command';
import { Messages, SfdxError } from '@salesforce/core';
import { AnyJson } from '@salesforce/ts-types';
import { AppUtils } from '../../utils/AppUtils';

// Initialize Messages with the current plugin directory
Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = Messages.loadMessages('vlocityEStools', 'deleteOldOS');


export default class deleteOldOS extends SfdxCommand {

  public static description = messages.getMessage('commandDescription');

  public static examples = [
  `$ sfdx vlocityTools:deleteoldos -u myOrg@example.com -n 5
  `,
  `$ sfdx vlocityTools:deleteoldos --targetusername myOrg@example.com --numberversions 5
  `
  ];

  public static args = [{name: 'file'}];

  protected static flagsConfig = {
    numberversions: flags.integer({char: 'n', description: messages.getMessage('numberRecentVersions')})
  };

  // Comment this out if your command does not require an org username
  protected static requiresUsername = true;

  // Comment this out if your command does not support a hub org username
  //protected static supportsDevhubUsername = true;

  // Set this to true if your command requires a project workspace; 'requiresProject' is false by default
  //protected static requiresProject = false;

  public async run(): Promise<AnyJson> {

    var versionsToKeep = this.flags.numberversions;

    AppUtils.logInitial(messages.getMessage('command'));
    AppUtils.log2('versionsToKeep: ' + versionsToKeep);

    if(versionsToKeep > 0){
      // this.org is guaranteed because requiresUsername=true, as opposed to supportsUsername
      const conn = this.org.getConnection();
      const query = 'SELECT ID, Name, vlocity_cmt__Version__c, vlocity_cmt__IsActive__c, vlocity_cmt__Language__c, vlocity_cmt__Type__c, vlocity_cmt__SubType__c FROM vlocity_cmt__OmniScript__c  Order By Name, vlocity_cmt__Language__c,vlocity_cmt__Type__c,vlocity_cmt__SubType__c,vlocity_cmt__Version__c DESC';

      // The type we are querying for
      interface vlocity_cmt__OmniScript__c {
        ID: string;
        vlocity_cmt__IsActive__c: boolean;
        Name: string;
        vlocity_cmt__Language__c: string;
        vlocity_cmt__Type__c: string;
        vlocity_cmt__SubType__c:string;
        vlocity_cmt__Version__c: number;
      }

      // Query the org
      const result = await conn.query<vlocity_cmt__OmniScript__c>(query);

      // The output and --json will automatically be handled for you.
      if (!result.records || result.records.length <= 0) {
        throw new SfdxError(messages.getMessage('errorNoOrgResults', [this.org.getOrgId()]));
      }

      var firstresult = result.records[0]
      var currentComp = firstresult.Name + firstresult.vlocity_cmt__Language__c + firstresult.vlocity_cmt__Type__c + firstresult.vlocity_cmt__SubType__c;

      var count = 0;

      var OStoDetele = new Array();

      AppUtils.log2('The Following OmniScritps will be deteled:');


      for (var i=0; i<result.records.length; i++) {
        var record = result.records[i];
        var componentid = record.Name + record.vlocity_cmt__Language__c + record.vlocity_cmt__Type__c + record.vlocity_cmt__SubType__c;
        if(currentComp==componentid) {
          count = count + 1;
        }
        else {
          currentComp = componentid;
          count =  1;
        }

        if(count > versionsToKeep && !record.vlocity_cmt__IsActive__c) {
          OStoDetele.push(record);
          var output = 'Name: ' + record.Name + ', Language: ' + record.vlocity_cmt__Language__c + ', Type: '  + record.vlocity_cmt__Type__c + ', SubType: ' + record.vlocity_cmt__SubType__c + ', Version: ' + record.vlocity_cmt__Version__c
          AppUtils.log1(output);
        }
        //console.log(componentid + ' ' + record.vlocity_cmt__Version__c + ' Delete?:' + toDelete);
      }

      if(OStoDetele.length > 0) {
        await new Promise((resolveBatch) => {
            var job = conn.bulk.createJob("vlocity_cmt__OmniScript__c", "delete");
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
                var output = 'Name: ' + rets[i].Name + ', Language: ' + rets[i].vlocity_cmt__Language__c + ', Type: '  + rets[i].vlocity_cmt__Type__c + ', SubType: ' + rets[i].vlocity_cmt__SubType__c + ', Version: ' + rets[i].vlocity_cmt__Version__c
                if (rets[i].success) {
                  AppUtils.log1("#" + (i+1) + " Delete successfully: " + output);
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
      AppUtils.log2("Error: -n, --numberversions has to be greated than 0");
    }
  }
}
