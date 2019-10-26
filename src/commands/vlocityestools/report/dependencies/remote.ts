import { flags, SfdxCommand } from '@salesforce/command';
import { Messages, SfdxError } from '@salesforce/core';
import { AppUtils } from '../../../../utils/AppUtils';

// Initialize Messages with the current plugin directory
Messages.importMessagesDirectory(__dirname);

    //////// OmniScrits
    var languageField;
    var typeField;
    var subTypeField;
    var isActiveField;
    var versionField;
    var isProcedureField;
    var isResusableField;
    var elementsRelation;
    var propertySetOSField;
    //////// Element 
    var elementPropertySetObject;
    var elementOSIDField;



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

    const conn = this.org.getConnection();

    ////// GET OS VALUES

    languageField = AppUtils.replaceaNameSpace('%name-space%Language__c');
    typeField = AppUtils.replaceaNameSpace('%name-space%Type__c');
    subTypeField = AppUtils.replaceaNameSpace('%name-space%SubType__c');
    isActiveField  = AppUtils.replaceaNameSpace('%name-space%IsActive__c');
    versionField  = AppUtils.replaceaNameSpace('%name-space%Version__c');
    isProcedureField  = AppUtils.replaceaNameSpace('%name-space%IsProcedure__c');
    isResusableField  = AppUtils.replaceaNameSpace('%name-space%IsReusable__c');
    ////
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

    var oSValuesResults = await conn.query(oSValuesQueryFinal);


    let oSValuesPap = new Map();

    for (var i=0; i<oSValuesResults.records.length; i++) {
      var element = oSValuesResults.records[i];
      //console.log('///////' + Object.keys(element) + ' ///' + element['Id'])
      oSValuesPap.set(element['Id'], element); 
    }

    ////// Create Maps
    var initialQuery = AppUtils.replaceaNameSpace('SELECT %name-space%OmniScriptId__c , COUNT(Id) Total ');
    initialQuery = initialQuery + AppUtils.replaceaNameSpace('FROM %name-space%Element__c ');
    initialQuery = initialQuery + AppUtils.replaceaNameSpace('GROUP BY %name-space%OmniScriptId__c');
    var queryString = AppUtils.replaceaNameSpace(initialQuery);

    var resultFirst = await conn.query(queryString);

    var currentCount = 0
    var batches = new Array<string>();
    var currentBatch = '';
    for (var i=0; i<resultFirst.records.length; i++) {
      var record = resultFirst.records[i];
      var numberOfElements = record['Total'];
      var dataPackId = record[AppUtils.replaceaNameSpace('%name-space%OmniScriptId__c')];

      var dataPackRecord = oSValuesPap.get(dataPackId);
      var shouldBeIncluded = (oSValuesPap.get(dataPackId)!= undefined);

      //console.log('//////shouldBeIncluded: ' + shouldBeIncluded);

      if((i == (+resultFirst.records.length - 1)) && ((currentCount+numberOfElements)>10000) ){
        batches.push(currentBatch);
        if(shouldBeIncluded == true){
          currentBatch = dataPackId;
          currentCount = numberOfElements;
          batches.push(currentBatch);
        } 
      }else if((i == (+resultFirst.records.length - 1)) && ((currentCount+numberOfElements)<10000) ){
        if(shouldBeIncluded == true){
          currentBatch = currentBatch + ', ' + dataPackId;
          currentCount =  currentCount + numberOfElements;
        }
        batches.push(currentBatch);
      }
      else {
        if(shouldBeIncluded == true ){
          if(currentBatch != ''){
            currentBatch = currentBatch + ', ' + dataPackId;
            currentCount =  currentCount + numberOfElements;
          } else { 
            currentBatch =  dataPackId;
            currentCount =  numberOfElements;
          }
        } else {
          currentBatch = '';
          currentCount = 0;
        }
      }

    }

    ////// 

    remote.lauchBatches(conn, batches,fs);

  }


  static lauchBatches(conn,batches,fs){
    var elementsQuery = 'SELECT id, %name-space%OmniScriptId__c, %name-space%PropertySet__c '
    elementsQuery = elementsQuery +  'FROM %name-space%Element__c '

    AppUtils.log3('Looking for OmniScripts and IntegrationProcedures in the environmemt'); 
    
    
    batches.forEach(batch => {

      var queryWithIds = elementsQuery 
      var queryString2 = AppUtils.replaceaNameSpace(queryWithIds);

      console.log('/////QUERY: ' +queryString2)
  
      conn.bulk.query(queryString2)
      .on('record', function(result) { 
        if(result!=undefined){
        console.log('/////RECORD: ' + Object.keys(result));
        console.log(record[propertySetOSField]);
        console.log('/////');
        AppUtils.log3('Found: ' + result.records.length + ' Active OmniScripts and IntegrationProcedures'); 

        var totalDependenciesFound = 0;

        AppUtils.log3('Finding Dependencies...'); 

        for (var i=0; i<result.records.length; i++) {
          var record = result.records[i];

          var omniScriptPropertySet = record[propertySetOSField];
          if( omniScriptPropertySet != '') {
            var resultDepPS = remote.getPropertySetValues(CreateFiles,omniScriptPropertySet,dataPackType,dataPack,isReusableValue);
            totalDependenciesFound = totalDependenciesFound + resultDepPS;
          }

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
        }
      })
      .on('error', function(err) { 
        console.error(err); 
      });

  });
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
