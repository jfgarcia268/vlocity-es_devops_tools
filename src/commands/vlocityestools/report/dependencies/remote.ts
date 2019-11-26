import { flags, SfdxCommand } from '@salesforce/command';
import { Messages } from '@salesforce/core';
import { AppUtils } from '../../../../utils/AppUtils';

// Initialize Messages with the current plugin directory
Messages.importMessagesDirectory(__dirname);

//////// OmniScrits Fields
var languageField;
var typeField;
var subTypeField;
var isActiveField;
var versionField;
var isProcedureField;
var isResusableField;
var propertySetOSField;

//////// Element Fields
var elementOSIDField;


//////// var
var totalDependenciesFound;
var numberofOSandVIP;
var resultsFile = './Dependencies_Report_Remote.csv'; 


// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = Messages.loadMessages('vlocityestools', 'reportdependenciesremote');

export default class remote extends SfdxCommand {

  public static description = messages.getMessage('commandDescription');

  public static examples = [
  `$ sfdx vlocityestools:report:dependencies:remote -u SIT -p cmt
  `,
  `$ sfdx vlocityestools:report:dependencies:remote --targetusername myOrg@example.com --packageType ins
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

    totalDependenciesFound = 0;

    AppUtils.log2('Results File: ' + resultsFile ); 
    if (fs.existsSync(resultsFile)) {
      fs.unlinkSync(resultsFile);
    }

    const CreateFiles = fs.createWriteStream(resultsFile, {flags: 'a'});
    var initialHeader = 'DataPack Name,Is Reusable,Dependency,Dependency Type,Remote Class,Remote Method';
    CreateFiles.write(initialHeader+'\r\n');   

    var packageType = this.flags.package;
    if(packageType == 'cmt'){
      AppUtils.namespace = 'vlocity_cmt__';
    } else if(packageType == 'ins'){
      AppUtils.namespace = 'vlocity_ins__';
    } else {
      throw new Error("Error: -p, --package has to be either cmt or ins ");
    }
    
    AppUtils.logInitial(messages.getMessage('command'));

    const conn = this.org.getConnection();

    ////// Field Values
    languageField = AppUtils.replaceaNameSpace('%name-space%Language__c');
    typeField = AppUtils.replaceaNameSpace('%name-space%Type__c');
    subTypeField = AppUtils.replaceaNameSpace('%name-space%SubType__c');
    isActiveField  = AppUtils.replaceaNameSpace('%name-space%IsActive__c');
    versionField  = AppUtils.replaceaNameSpace('%name-space%Version__c');
    isProcedureField  = AppUtils.replaceaNameSpace('%name-space%IsProcedure__c');
    isResusableField  = AppUtils.replaceaNameSpace('%name-space%IsReusable__c');
    propertySetOSField  = AppUtils.replaceaNameSpace('%name-space%PropertySet__c');
    elementOSIDField =  AppUtils.replaceaNameSpace('%name-space%OmniScriptId__c');

    var oSValuesQuery = 'SELECT ID, Name';
    oSValuesQuery = oSValuesQuery + ', ' + languageField 
    oSValuesQuery = oSValuesQuery + ', ' + typeField 
    oSValuesQuery = oSValuesQuery + ', ' + subTypeField 
    oSValuesQuery = oSValuesQuery + ', ' + isActiveField 
    oSValuesQuery = oSValuesQuery + ', ' + isProcedureField  
    oSValuesQuery = oSValuesQuery + ', ' + versionField  
    oSValuesQuery = oSValuesQuery + ', ' + isResusableField 
    oSValuesQuery = oSValuesQuery + ', ' + propertySetOSField
    oSValuesQuery = oSValuesQuery + ' FROM %name-space%OmniScript__c ';
    oSValuesQuery = oSValuesQuery + ' WHERE ' + isActiveField + ' = true';
    var oSValuesQueryFinal = AppUtils.replaceaNameSpace(oSValuesQuery);

    AppUtils.log3('Looking for OmniScripts and IntegrationProcedures in the environmemt');
    var oSValuesResults = await conn.query(oSValuesQueryFinal);

    let oSValuesMap = new Map<string,Object>();

    for (var i=0; i<oSValuesResults.records.length; i++) {
      var element = oSValuesResults.records[i];
      //console.log('///////' + Object.keys(element) + ' ///' + element['Id'])
      oSValuesMap.set(element['Id'], element); 
    }

    AppUtils.log3('OmniScripts and IntegrationProcedures Found: ' + oSValuesResults.records.length);
    numberofOSandVIP = oSValuesResults.records.length;

    ////// 
    AppUtils.log3('Looking for Dependencies in Main DataPack');
    remote.OmniScriptPropertySet(conn,fs,oSValuesResults,CreateFiles);  
    
    ////// 
    AppUtils.log3('Looking for Dependencies in All Elements');
    conn.bulk.pollInterval = 5000; // 5 sec
    conn.bulk.pollTimeout = 60000; // 60 sec
    remote.queryElements(conn,fs,oSValuesMap,CreateFiles);


  }

  static report(){
        ////////// Report
        console.log('')
        AppUtils.log3('Donde Finding Dependencies'); 
        AppUtils.log3('Number of OmniScripts and IntegrationProcedures Scanned: ' + numberofOSandVIP); 
        AppUtils.log3('Number of Total Dependencies Found: ' + totalDependenciesFound); 
        AppUtils.log3('CSV File Generated: ' + resultsFile); 
        console.log('')
  }

  static OmniScriptPropertySet(conn,fs,omniScripRecords,CreateFiles){
    var totalDep = 0;
    omniScripRecords.records.forEach(element => {
      var propertySet = element[propertySetOSField];
      var omniScriptType = element[typeField];
      var omniScriptSubType = element[subTypeField];
      var omniScriptLanguage = element[languageField];
      var dataPack = omniScriptType + '_' + omniScriptSubType + '_' + omniScriptLanguage;
      var isReusableValue = element[isResusableField];
      var dataPackType = 'OmniScript'
      if(element[isProcedureField]==true){
        var dataPackType = 'IntegrationProcedure'
      }
      if(propertySet != undefined){
        var resultDep = remote.getPropertySetValues(CreateFiles,propertySet,dataPackType,dataPack,isReusableValue);
        totalDep = totalDep + resultDep;
      }
    });
    totalDependenciesFound = totalDependenciesFound + totalDep;
  }


  static queryElements(conn,fs,omniScripRecords,CreateFiles){

    var elementsQuery = 'SELECT Id, Name, %name-space%OmniScriptId__c, %name-space%PropertySet__c '
    elementsQuery = elementsQuery +  'FROM %name-space%Element__c '
    var queryString2 = AppUtils.replaceaNameSpace(elementsQuery);
    var totalDependenciesFound2 = 0; 

    // LIMIT 5 OFFSET 2
    
    conn.bulk.query(queryString2)
    .on('record', function(result) { 
      //console.log('/////QUERY: ' +queryString2)
      var elementPropertySet = result[propertySetOSField];
      var omniScripId = result[elementOSIDField];
      var omniScripRecord = omniScripRecords.get(omniScripId);
      if (omniScripRecord!=undefined){ 
        var dataPackType = 'OmniScript'
        if(omniScripRecord[isProcedureField]==true){
          var dataPackType = 'IntegrationProcedure'
        }
        var omniScriptType = omniScripRecord[typeField];
        var omniScriptSubType = omniScripRecord[subTypeField];
        var omniScriptLanguage = omniScripRecord[languageField];
        var dataPack = omniScriptType + '_' + omniScriptSubType + '_' + omniScriptLanguage;
        var isReusableValue = omniScripRecord[isResusableField];
        AppUtils.log2('Looking for Dependencies in ' + dataPackType + ': ' + dataPack );
        var resultDep = remote.getPropertySetValues(CreateFiles,elementPropertySet,dataPackType,dataPack,isReusableValue);
        totalDependenciesFound = totalDependenciesFound + resultDep;
      }
    })
    .on("queue", function(batchInfo) {
      AppUtils.log3('Done looking for Dependencies in Elements');
      console.log('queue, batchInfo:', batchInfo);
    })
    .on("end", function() {
      remote.report();
    })
    .on('error', function(err) { 
      console.error(err); 
    })
    totalDependenciesFound = totalDependenciesFound + totalDependenciesFound2;
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

    var remoteClass = jsonStringObjects['remoteClass'];
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
