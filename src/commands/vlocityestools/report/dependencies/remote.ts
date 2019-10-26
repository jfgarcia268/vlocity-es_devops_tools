import { flags, SfdxCommand } from '@salesforce/command';
import { Messages, SfdxError } from '@salesforce/core';
import { AnyJson } from '@salesforce/ts-types';
import { AppUtils } from '../../../../utils/AppUtils';

// Initialize Messages with the current plugin directory
Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = Messages.loadMessages('vlocityestools', 'reportdependenciesremote');

export default class remote extends SfdxCommand {

  public static description = messages.getMessage('commandDescription');

  public static examples = [
  `$ sfdx vlocityestools:report:dependencies:remote -u SIT
  `,
  `$ sfdx vlocityestools:report:dependencies:remote --targetusername myOrg@example.com
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

    const fs = require('fs');

    var packageType = this.flags.package;
    if(packageType == 'cmt'){
      AppUtils.namespace = 'vlocity_cmt__';
    } else if(packageType == 'ins'){
      AppUtils.namespace = 'vlocity_ins__';
    } else {
      throw new Error("Error: -p, --package has to be either cmt or ins ");
    }
    
    AppUtils.logInitial(messages.getMessage('command'));


    //////// OmniScritp
    var languageField = AppUtils.replaceaNameSpace('%name-space%Language__c');
    var typeField = AppUtils.replaceaNameSpace('%name-space%Type__c');
    var subTypeField = AppUtils.replaceaNameSpace('%name-space%SubType__c');
    var isActiveField  = AppUtils.replaceaNameSpace('%name-space%IsActive__c');
    var versionField  = AppUtils.replaceaNameSpace('%name-space%Version__c');
    var isProcedureField  = AppUtils.replaceaNameSpace('%name-space%IsProcedure__c');
    var isResusableField  = AppUtils.replaceaNameSpace('%name-space%IsReusable__c');
    var elementsRelation  = AppUtils.replaceaNameSpace('%name-space%Elements__r');
    //////// Element 
    var elementPropertySetObject  = AppUtils.replaceaNameSpace('%name-space%PropertySet__c');
     
    const conn = this.org.getConnection();
    var initialQuery = 'SELECT ID, Name';
    initialQuery = initialQuery + ', ' + languageField + ' '
    initialQuery = initialQuery + ', ' + typeField + ' ' 
    initialQuery = initialQuery + ', ' + subTypeField + ' ' 
    initialQuery = initialQuery + ', ' + isActiveField + ' ' 
    initialQuery = initialQuery + ', ' + isProcedureField + ' ' 
    initialQuery = initialQuery + ', ' + versionField + ' ' 
    initialQuery = initialQuery + ', ' + isResusableField + ' ' 
    initialQuery = initialQuery + ', (SELECT Name, ' + elementPropertySetObject + ' FROM ' + elementsRelation + ') ';
    initialQuery = initialQuery + ' FROM %name-space%OmniScript__c ';
    initialQuery = initialQuery + ' WHERE ' + isActiveField + ' = TRUE';
    
    const query = AppUtils.replaceaNameSpace(initialQuery);
    // Query the org
    AppUtils.log3('Looking for OmniScripts and IntegrationProcedures in the environmemt'); 
    const result = await conn.query(query);

    // The output and --json will automatically be handled for you.
    if (!result.records || result.records.length <= 0) {
      throw new SfdxError(messages.getMessage('errorNoOrgResults', [this.org.getOrgId()]));
    }
    AppUtils.log3('Found: ' + result.records.length + ' Active OmniScripts and IntegrationProcedures'); 

    var resultsFile = './Dependencies_Report_Local.csv'; 
    AppUtils.log2('Results File: ' + resultsFile ); 
    if (fs.existsSync(resultsFile)) {
      fs.unlinkSync(resultsFile);
    }

    const CreateFiles = fs.createWriteStream(resultsFile, {flags: 'a'});
    var initialHeader = 'DataPack Name,Is Reusable,Dependency,Dependency Type,Remote Class,Remote Method';
    CreateFiles.write(initialHeader+'\r\n');   

    var totalDependenciesFound = 0;

    AppUtils.log3('Finding Dependencies...'); 

    for (var i=0; i<result.records.length; i++) {
      var record = result.records[i];
      var elements = record[elementsRelation].records;
      var dataPackType = 'OmniScript'
      if(record[isProcedureField]){
        dataPackType = 'IntegrationProcedure'
      }

      var omniScriptType = record[typeField];
      var omniScriptSubType = record[subTypeField];
      var omniScriptLanguage = record[languageField];
      var dataPack = omniScriptType + '_' + omniScriptSubType + '_' + omniScriptLanguage;
      var isReusableValue = record[isResusableField];

      AppUtils.log2('Finding Dependencies for ' + dataPackType + ': ' + dataPack); 
      for (var j=0; j<elements.length; j++) {
        var propertySet = elements[j][elementPropertySetObject];
        var resultDep = remote.getPropertySetValues(CreateFiles,propertySet,dataPackType,dataPack,isReusableValue);
        totalDependenciesFound = totalDependenciesFound + resultDep;
      }
    }

        ////////// Report
        console.log('')
        AppUtils.log3('Donde Finding Dependencies'); 
        AppUtils.log3('Number of OmniScripts and IntegrationProcedures Scanned: ' + result.records.length); 
        AppUtils.log3('Number of Total Dependencies Found: ' + totalDependenciesFound); 
        AppUtils.log3('CSV File Generated: ' + resultsFile); 
        console.log('')
  }

  static getPropertySetValues(CreateFiles,propertySetObject,dataPackType,dataPack,isReusable) {
    var dependenciesFound = 0;
    var jsonStringObjects = JSON.parse(propertySetObject);
    var bundle = jsonStringObjects['bundle'];
    if(bundle != undefined && bundle != ''){
      //console.log('bundle: ' + bundle);
      var dependencyRecord =  dataPackType + '/' + dataPack + ',' + isReusable + ',DataRaptor/' +  bundle + ',DataRaptor,None,None';
      CreateFiles.write(dependencyRecord+'\r\n');   
      dependenciesFound = dependenciesFound + 1;
    }

    var type = jsonStringObjects['Type'];
    var subType = jsonStringObjects['Sub Type'];
    var language = jsonStringObjects['Language'];
    var omniScriptcompleteName = type + '_' + subType + '_' + language;
    if(type != undefined && type != ''){
      //console.log('completeName: ' + completeName);
      var dependencyRecord =  dataPackType + '/' + dataPack + ',' + isReusable + ',OmniScript/' +  omniScriptcompleteName + ',OmniScript,None,None';
      CreateFiles.write(dependencyRecord+'\r\n');   
      dependenciesFound = dependenciesFound + 1;
    }

    var vipKey = jsonStringObjects['integrationProcedureKey'];
    if(vipKey != undefined && vipKey != ''){
      //console.log('vipKey: ' + vipKey);
      var dependencyRecord =  dataPackType + '/' + dataPack + ',' + isReusable + ',IntegrationProcedure/' +  vipKey + ',IntegrationProcedure,None,None';
      CreateFiles.write(dependencyRecord+'\r\n'); 
      dependenciesFound = dependenciesFound + 1;  
    }

    var remoteClass = jsonStringObjects[remoteClass];
    var remoteMethod = jsonStringObjects['remoteMethod'];
    if(remoteClass != undefined && remoteClass != ''){
      //console.log('remoteClass.remoteClass: ' + remoteClass + '.' + remoteMethod);
      var dependencyRecord =  dataPackType + '/' + dataPack + ',' + isReusable + ',' + remoteClass + '.' + remoteMethod + ',REMOTE CALL,' + remoteClass + ',' + remoteMethod;
      CreateFiles.write(dependencyRecord+'\r\n');   
      dependenciesFound = dependenciesFound + 1;
    }

    var templateID = jsonStringObjects['HTMLTemplateId'];
    if(templateID != undefined && templateID != ''){
      //console.log('templateID: ' + templateID);
      var dependencyRecord =  dataPackType + '/' + dataPack + ',' + isReusable + ',VlocityUITemplate/' +  templateID + ',VlocityUITemplate,None,None';
      CreateFiles.write(dependencyRecord+'\r\n');  
      dependenciesFound = dependenciesFound + 1; 
    }

    return dependenciesFound;
  }



}
