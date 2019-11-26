import { flags, SfdxCommand } from '@salesforce/command';
import { Messages, SfdxError } from '@salesforce/core';
import { AppUtils } from '../../../utils/AppUtils';

// Initialize Messages with the current plugin directory
Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = Messages.loadMessages('vlocityestools', 'activeos');

export default class activeOmniScripts extends SfdxCommand {

  public static description = messages.getMessage('commandDescription');

  public static examples = [
  `$ sfdx vlocityestools:report:activeomniscript -u myOrg@example.com -p cmt
  `,
  `$ sfdx vlocityestools:report:activeomniscript  --targetusername myOrg@example.com --package ins
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

  public async run() {

    var packageType = this.flags.package;

    if(packageType == 'cmt'){
      AppUtils.namespace = 'vlocity_cmt__';
    } else if(packageType == 'ins'){
      AppUtils.namespace = 'vlocity_ins__';
    } else {
      throw new Error("Error: -p, --package has to be either cmt or ins ");
    }
    
    AppUtils.logInitial(messages.getMessage('command'));

    try {

      const conn = this.org.getConnection();
      const query = 'SELECT ID, Name, %name-space%Version__c, %name-space%IsActive__c, %name-space%Language__c, %name-space%Type__c, %name-space%SubType__c FROM %name-space%OmniScript__c  Order By Name, %name-space%Language__c, %name-space%Type__c,%name-space%SubType__c, %name-space%Version__c DESC';
      const initialQuery = AppUtils.replaceaNameSpace(query);
      // Query the org
      const result = await conn.query(initialQuery);

      // The output and --json will automatically be handled for you.
      if (!result.records || result.records.length <= 0) {
      throw new SfdxError(messages.getMessage('errorNoOrgResults', [this.org.getOrgId()]));
      }

      var nameField = 'Name';
      var languageField = AppUtils.replaceaNameSpace('%name-space%Language__c');
      var typeField = AppUtils.replaceaNameSpace('%name-space%Type__c');
      var subTypeField = AppUtils.replaceaNameSpace('%name-space%SubType__c');
      var isActiveField = AppUtils.replaceaNameSpace('%name-space%IsActive__c');


      var lastresult = result.records[0]
      var currentComp = lastresult[nameField] + lastresult[languageField] + lastresult[typeField] + lastresult[subTypeField];
      console.log('  >> The Following OmniScritps does not have an active version:');
      var currentIsActive = false;
      var count = 0;

      for (var i=0; i<result.records.length; i++) {
          var record = result.records[i];
          var componentid = record[nameField] + record[languageField]+ record[typeField] + record[subTypeField];
          //console.log('ACTIVE: ' + record[isActiveField] + '  Name: ' + record[nameField] + ' Language: ' + record[languageField] + ' Type: ' + record[typeField] + ' SubType: ' +record[subTypeField]); 
          if(currentComp!=componentid) {
              if(currentIsActive == false) {
                console.log('    > Name: ' + lastresult[nameField] + ' Language: ' + lastresult[languageField] + ' Type: ' + lastresult[typeField] + ' SubType: ' +lastresult[subTypeField]);
                count = count + 1;  
              }
              currentIsActive = record[isActiveField];
          }
          else {
              if (record[isActiveField] == true) {
                  currentIsActive = true;
              }
          }  
          currentComp = componentid;
          lastresult = record;
      }

      console.log('  >> Number of OmniScritps with no active version: ' + count );

  } catch (e) {
      console.log(e); 
  }

  }
    
}
