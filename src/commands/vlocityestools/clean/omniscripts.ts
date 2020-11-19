import { flags, SfdxCommand } from '@salesforce/command';
import { Messages, SfdxError } from '@salesforce/core';
import { AppUtils } from '../../../utils/AppUtils';
import { DBUtils } from '../../../utils/DBUtils';

// Initialize Messages with the current plugin directory
Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = Messages.loadMessages('vlocityestools', 'oldomniscripts');

export default class deleteOldOS extends SfdxCommand {

  public static description = messages.getMessage('commandDescription');

  public static examples = [
  `$ sfdx vlocityestools:clean:omniscripts -u myOrg@example.com -n 5 -p cmt
  `,
  `$ sfdx vlocityestools:clean:omniscripts --targetusername myOrg@example.com --numberversions 5 --package ins
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

  public async run(){

    var versionsToKeep = this.flags.numberversions;
    var packageType = this.flags.package;

    const conn = this.org.getConnection();

    var nameSpaceSet = await AppUtils.setNameSpace(conn,packageType);
    if(!nameSpaceSet){
      throw new SfdxError("Error: Package was not set or incorrect was provided.");
    } else {
      AppUtils.ux = this.ux;
      AppUtils.logInitial(messages.getMessage('command'));
      AppUtils.log2('Versions To Keep: ' + versionsToKeep);

      if(versionsToKeep > 0){
        // this.org is guaranteed because requiresUsername=true, as opposed to supportsUsername
        const initialQuery = 'SELECT ID, Name, %name-space%Version__c, %name-space%IsActive__c, %name-space%Language__c, %name-space%Type__c, %name-space%SubType__c FROM %name-space%OmniScript__c  Order By Name, %name-space%Language__c, %name-space%Type__c,%name-space%SubType__c, %name-space%Version__c DESC';
        const query = AppUtils.replaceaNameSpace(initialQuery);
        // Query the org
        var result = await DBUtils.bulkAPIquery(conn,query);
        // The output and --json will automatically be handled for you.
        var nameField = 'Name';
        var languageField = AppUtils.replaceaNameSpace('%name-space%Language__c');
        var typeField = AppUtils.replaceaNameSpace('%name-space%Type__c');
        var subTypeField = AppUtils.replaceaNameSpace('%name-space%SubType__c');
        var isActiveField  = AppUtils.replaceaNameSpace('%name-space%IsActive__c');
        var versionField  = AppUtils.replaceaNameSpace('%name-space%Version__c');

        if(result.length == 0) {
           AppUtils.log2('No OmniScritps in the Org');
        } else {
          var firstresult = result[0];
          var currentComp = firstresult[nameField] + firstresult[languageField] + firstresult[typeField] + firstresult[subTypeField];
          var count = 0;
          var OStoDetele = [];

          AppUtils.log2('The Following OmniScritps will be deteled:');
          for (var i=0; i<result.length; i++) {
            var record = result[i];
            var componentid = record[nameField] + record[languageField]+ record[typeField] + record[subTypeField];
            
            if(currentComp==componentid) {
              count++;
            }
            else {
              currentComp = componentid;
              count =  1;
            }
            
            if(count > versionsToKeep && record[isActiveField] == 'false') {
              var output = 'Name: ' + record[nameField] + ', Language: ' + record[languageField] + ', Type: '  + record[typeField] + ', SubType: ' + record[subTypeField] + ', Version: ' + record[versionField];
              AppUtils.log1(output);
              delete record[nameField];
              delete record[versionField]; 
              delete record[isActiveField]; 
              delete record[languageField];
              delete record[typeField]; 
              delete record[subTypeField]; 
              OStoDetele.push(record);
            }
          }

          if(OStoDetele.length > 0){
            AppUtils.log3("Deleting Old OmniScrips");
            var OSAPIName = AppUtils.replaceaNameSpace('%name-space%OmniScript__c');
            await DBUtils.bulkAPIdelete(OStoDetele,conn,OSAPIName,false,false,null,120);
          } else {
            AppUtils.log2("Nothing to delete");
          }
        }
      }
    } 
  }
}
