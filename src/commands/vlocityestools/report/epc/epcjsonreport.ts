import { flags, SfdxCommand } from '@salesforce/command';
import { Messages } from '@salesforce/core';
import { AppUtils } from '../../../../utils/AppUtils';

// Initialize Messages with the current plugin directory
Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = Messages.loadMessages('vlocityestools', 'epcjsonreport');

const fsExtra = require("fs-extra");
const yaml = require('js-yaml');

var splitChararter = ',';
const strinQuote = '';

var keyNames = [];

var currentJsonField = '';

var numberOfLevels = 0;

var cont = 0;
var cont2 = 0;

export default class epcJsonExport extends SfdxCommand {

  public static description = messages.getMessage('commandDescription');

  

  public static examples = [
  `$ sfdx vlocityestools:report:epc:epcjsonreport -u myOrg@example.com -p cmt -d data.yaml
  `,
  `$ sfdx vlocityestools:report:epc:epcjsonreport --targetusername myOrg@example.com --package ins --datafile data.yaml
  `
  ];

  public static args = [{name: 'file'}];

  protected static flagsConfig = {
    package: flags.string({char: 'p', description: messages.getMessage('packageType')}),
    datafile: flags.string({char: 'd', description: messages.getMessage('dataFile')}),
    separator: flags.string({char: 's', description: messages.getMessage('separator')})
  };

  // Comment this out if your command does not require an org username
  protected static requiresUsername = true;

  // Comment this out if your command does not support a hub org username
  //protected static supportsDevhubUsername = true;

  // Set this to true if your command requires a project workspace; 'requiresProject' is false by default
  //protected static requiresProject = false;

  
  public async run() {

    var packageType = this.flags.package;
    var dataFile = this.flags.datafile;
    var separator = this.flags.separator;

    if(packageType == 'cmt'){
      AppUtils.namespace = 'vlocity_cmt__';
    } else if(packageType == 'ins'){
      AppUtils.namespace = 'vlocity_ins__';
    } else {
      throw new Error("Error: -p, --package has to be either cmt or ins ");
    }

    if(separator){
      splitChararter = separator;
    }

    if(dataFile == null){
      throw new Error("Error: -d, --dataFile has to be passed");
    }

    if (!fsExtra.existsSync(dataFile)) {
      throw new Error("Error: File: " + dataFile + " does not exist");
    }

    AppUtils.ux = this.ux;
    AppUtils.logInitial(messages.getMessage("command"));
    AppUtils.log3( "EPC Json Report: " + 'Starting Report');
    AppUtils.ux.log(' ');

    try {
      var resultData = [];
      const conn = this.org.getConnection();

      var doc = yaml.safeLoad(fsExtra.readFileSync(dataFile, 'utf8'));

      var resultData = [];

      for (let index = 0; index < Object.keys(doc.Objects).length; index++) {
        var element = Object.keys(doc.Objects)[index];
        var ObjectNameYaml = AppUtils.replaceaNameSpaceFromFile(element);
        var ObjectName = ObjectNameYaml.split('-')[0];
        var numberFile = '';
        if(ObjectNameYaml.split('-')[1]){
          numberFile = ObjectNameYaml.split('-')[1] + '_'
        }
        var all = doc.Objects[element]['All'];
        var fields = doc.Objects[element]['Fields'];
        var jsonFields = doc.Objects[element]['JsonFields'];
        var onlyJson = doc.Objects[element]['OnlyJsonFields'];
        var numOfKeys = doc.Objects[element]['numOfKeys']; 
        var simpleJsonArray = doc.Objects[element]['simpleJsonArray']; 
        var fieldsString = '';

        if (numOfKeys && numOfKeys > 0 ) {
          numberOfLevels = numOfKeys;
          for (let index = 1; index <= numberOfLevels; index++) {
            var key = doc.Objects[element]['key' + index];
            keyNames.push(key);
          }
        }

        if(all) {
          var meta  = await conn.sobject(ObjectName).describe();
          for (let i = 0; i < meta.fields.length; i++) {
            const objectField = meta.fields[i].name;
            if(objectField != 'Id') {
              fieldsString += objectField + splitChararter;
            }
          }
          fieldsString = fieldsString.substring(0, fieldsString.length - 1);
        } else {
          fieldsString = AppUtils.replaceaNameSpaceFromFile(JSON.stringify(fields)).replace('[', '').replace(']', '').replace(/\"/g, "") + "";
        }
        
        if (simpleJsonArray) {
          for (let j = 0; j < Object.keys(jsonFields).length; j++) {
            currentJsonField = Object.keys(jsonFields)[j];
            const jsonField = AppUtils.replaceaNameSpaceFromFile(Object.keys(jsonFields)[j]);
            var resultFile = ObjectName + '_' + jsonField + '_' + numberFile + 'Result.csv';
            if (fsExtra.existsSync(resultFile)) {
              fsExtra.unlinkSync(resultFile);
            }
            var jsonFieldsKeys = jsonFields[Object.keys(jsonFields)[j]];
            var result = await epcJsonExport.exportObject(conn, resultFile, ObjectName, fieldsString, epcJsonExport.formatWithSimpleJsonArray, fieldsString,jsonField,jsonFieldsKeys,all,onlyJson);
            resultData.push({ ObjectName: ObjectName + ' - ' + jsonField, RecordsExported: result['exported'] , RecordsCreated: result['created'] , ReportFile: resultFile });
            console.log(' ');
          }
        } else if (jsonFields == null) {
          var resultFile = ObjectName + '_' + numberFile + 'Result.csv';
          //console.log('resultFile: ' + resultFile);
          if (fsExtra.existsSync(resultFile)) {
            fsExtra.unlinkSync(resultFile);
          }
          var result = await epcJsonExport.exportObject(conn, resultFile, ObjectName, fieldsString, epcJsonExport.formatGeneric, fieldsString,null,null,all,onlyJson);
          resultData.push({ ObjectName: ObjectName, RecordsExported: result['exported'] , RecordsCreated: result['created'] , ReportFile: resultFile });
          console.log(' ');
        } else {
            for (let j = 0; j < Object.keys(jsonFields).length; j++) {
              currentJsonField = Object.keys(jsonFields)[j];
              const jsonField = AppUtils.replaceaNameSpaceFromFile(Object.keys(jsonFields)[j]);
              var resultFile = ObjectName + '_' + jsonField + '_' + numberFile + 'Result.csv';
              if (fsExtra.existsSync(resultFile)) {
                fsExtra.unlinkSync(resultFile);
              }
              var jsonFieldsKeys = jsonFields[Object.keys(jsonFields)[j]];
              var result = await epcJsonExport.exportObject(conn, resultFile, ObjectName, fieldsString, epcJsonExport.formatWithJson, fieldsString,jsonField,jsonFieldsKeys,all,onlyJson);
              resultData.push({ ObjectName: ObjectName + ' - ' + jsonField, RecordsExported: result['exported'] , RecordsCreated: result['created'] , ReportFile: resultFile });
              console.log(' ');
            }
        }
      }

      var tableColumnData = ['ObjectName', 'RecordsExported', 'RecordsCreated', 'ReportFile']; 
      AppUtils.ux.log('RESULTS:');
      //AppUtils.ux.log(' ');
      AppUtils.ux.table(resultData, tableColumnData);
      AppUtils.ux.log(' ');

    } catch (e) {
        console.log(e); 
    }
  }


  static formatGeneric(result,createFiles,fieldsArray,jsonField,jsonValues) {
    var baseline = epcJsonExport.formatNormallFields(result,fieldsArray);
    createFiles.write(baseline+'\r\n'); 
    cont++; 
  }

  static formatAttributeRules(jsonData, jsonValues, baseline, createFiles, keyValues) {
    //console.log('jsonData: ' + JSON.stringify(jsonData));
    var keys = Object.keys(jsonData);
    for (const key of keys) {
      var term = jsonData[key];
      for (let index = 0; index < term.length; index++) {
        var term2 = term[index];
        var newLine = baseline + epcJsonExport.getKeysNameforLine(keyValues);
        var secondLevelArray =  epcJsonExport.getSecondLevelArray(jsonValues,jsonData); 
        //console.log('jsonData: ' + JSON.stringify(jsonData));
        if(secondLevelArray && secondLevelArray.length > 0) {
          newLine += epcJsonExport.formatLine(jsonValues, term2, true );
          epcJsonExport.formatSecondLevelArray(secondLevelArray,jsonValues,createFiles,newLine);
        }
        else{
          newLine += epcJsonExport.formatLine(jsonValues, term2, false);
          createFiles.write(newLine+'\r\n'); 
          cont++;
        }        
      }
    }
  }

  static getKeysNameforLine(keyNames){
    var newLine = '';
    for (const element of keyNames) {
      newLine += element + splitChararter;
    }
    return newLine;
  }  

  static getSecondLevelArray(jsonValues,jsonData){
    if(jsonValues[jsonValues.length -1] && (typeof jsonValues[jsonValues.length -1] === 'object')){
      //console.log('jsonValues[jsonValues.length -1]: ' + JSON.stringify(jsonValues[jsonValues.length -1]) );
      //console.log('jsonData: ' + JSON.stringify(jsonData));
      return AppUtils.getDataByPath(jsonData,Object.keys(jsonValues[jsonValues.length -1])[0]);
    }
  }

  static formatRecord(jsonData,keyNames,createFiles,jsonValues,baseline) {
    if(Array.isArray(jsonData)) {
      //console.log('1')
      for(var i = 0 ; i < jsonData.length ; i++){
        var term = jsonData[i];
        var newLine = baseline + epcJsonExport.getKeysNameforLine(keyNames);
        //console.log('jsonData: ' + jsonData);
        var secondLevelArray =  epcJsonExport.getSecondLevelArray(jsonValues,term); 
        if(secondLevelArray && secondLevelArray.length > 0) {
          newLine += epcJsonExport.formatLine(jsonValues, term, true );
          epcJsonExport.formatSecondLevelArray(secondLevelArray,jsonValues,createFiles,newLine);
          //console.log('1.1: ' + JSON.stringify(term));
        }
        else{
          newLine += epcJsonExport.formatLine(jsonValues, term, false);
          createFiles.write(newLine+'\r\n'); 
          //console.log('1.2 '+ JSON.stringify(term));
          cont++;
        }
      }
    } else {
      //console.log('2')
      if (currentJsonField = 'namespace__AttributeRules__c') {
        //console.log('jsonData: ' + JSON.stringify(jsonData));
        //console.log('2.1 '+ JSON.stringify(jsonData));
        epcJsonExport.formatAttributeRules(jsonData, jsonValues, baseline, createFiles, keyNames);
      } else {
        //console.log('2.2 '+ JSON.stringify(jsonData));
        var newLine = baseline + epcJsonExport.getKeysNameforLine(keyNames);
        newLine += epcJsonExport.formatLine(jsonValues, term, false);
        createFiles.write(newLine+'\r\n'); 
        cont++;
      }
    }

  }

  static formatSecondLevelArray(secondLevelArray,jsonValues,createFiles,newLine){
    //console.log('///// secondLevelArray: ' + JSON.stringify(secondLevelArray));
    for (const secondLevelObjectIndex in secondLevelArray) {
      //console.log('secondLevelObjectIndex: ' + secondLevelObjectIndex);
      var secondLevelObject = secondLevelArray[secondLevelObjectIndex];
      var secondLevelLine = '';
      var secodLevelKeys = jsonValues[jsonValues.length -1][Object.keys(jsonValues[jsonValues.length -1])[0]];
      for (let index = 0; index < secodLevelKeys.length; index++) {
        var key = secodLevelKeys[index];
        var value = secondLevelObject[key];
        var valueResult = value? value : '';
        secondLevelLine += strinQuote + valueResult + strinQuote + splitChararter;
      }
      createFiles.write(newLine + secondLevelLine + '\r\n'); 
      cont++;
    }
  }

  static recursiveFormat(jsonData,missingTimes,keyNames,createFiles,jsonValues,baseline){
    //console.log('missingTimes: ' + missingTimes + ' jsonData: ' + JSON.stringify(jsonData));
    if(missingTimes == 0 ) {
      epcJsonExport.formatRecord(jsonData,keyNames,createFiles,jsonValues,baseline);
    } else {
      var keys = Object.keys(jsonData);
      for (const key of keys) {
        var attribute = jsonData[key];
        var newKeyNames = Object.assign([],keyNames);
        newKeyNames.push(key);
        epcJsonExport.recursiveFormat(attribute, missingTimes - 1, newKeyNames, createFiles,jsonValues,baseline);
      }
    }
  }

  static formatWithSimpleJsonArray(result,createFiles,fieldsArray,JsonField,jsonValues) {
    var baseline = epcJsonExport.formatNormallFields(result,fieldsArray);
    var jsonData = result[AppUtils.replaceaNameSpace(JsonField)];
    if(jsonData != null && jsonData != '[]' && jsonData != '{}') {
      var jsonDataResult = JSON.parse(jsonData);
      epcJsonExport.parseSimpleArray(jsonDataResult,baseline,createFiles);
    } else {
      createFiles.write(baseline+'\r\n');   
      cont++;
    }
  }

  static parseSimpleArray(jsonData,baseline,createFiles){
    var keys = Object.keys(jsonData);
    for (let index = 0; index < keys.length; index++) {
      const key = keys[index];
      const value = jsonData[key];
      var line = strinQuote + key + strinQuote + splitChararter;
      line += strinQuote + value + strinQuote + splitChararter;
      createFiles.write(baseline +line +'\r\n'); 
      cont++;
    }
  }

  static formatWithJson(result,createFiles,fieldsArray,JsonField,jsonValues) {
    var baseline = epcJsonExport.formatNormallFields(result,fieldsArray);
    var jsonData = result[AppUtils.replaceaNameSpace(JsonField)];
    if(jsonData != null && jsonData != '[]' && jsonData != '{}') {
      var jsonDataResult = JSON.parse(jsonData);
      var keyNames = [];
      epcJsonExport.recursiveFormat(jsonDataResult, numberOfLevels, keyNames, createFiles,jsonValues,baseline);
    } else {
      createFiles.write(baseline+'\r\n');   
      cont++;
    }
  }

  static formatLine(jsonValues, term, skipLast ) {
    var newLine = '';
    var loopLimit = skipLast? jsonValues.length - 1 : jsonValues.length;
    for (let index = 0; index < loopLimit; index++) {
      const jsonElement = jsonValues[index];
      //console.log('// jsonValue: ' + jsonValues + ' Value: ' + AppUtils.getDataByPath(term, jsonElement)  + ' looplimit: ' + loopLimit);
      var value = AppUtils.getDataByPath(term, jsonElement);
      var valueResult = value? value : '';
      newLine += strinQuote + valueResult + strinQuote + splitChararter;
    }
    return newLine;
  }

  static async exportObject(conn, resultsFile, ObjectName, header, formatFuntion,fields,jsonField,jsonValues,all,onlyJson) {
    var objectAPIName = AppUtils.replaceaNameSpace(ObjectName);
    AppUtils.log3( objectAPIName + ' Report, File: ' + JSON.stringify(resultsFile));

    if (fsExtra.existsSync(resultsFile)) {
      fsExtra.unlinkSync(resultsFile);
    }

    const createFiles = fsExtra.createWriteStream(resultsFile, {flags: 'a'});
    var fieldsArray = AppUtils.replaceaNameSpace(fields).split(',');
    
    var queryString= 'SELECT ID'
    if(!onlyJson) {
      for (const element of fieldsArray) {
        queryString += ',' + element;
      }
    }
    
    if(jsonField != null && !all) {
      queryString += ',' + AppUtils.replaceaNameSpace(jsonField);
    }
    queryString += ' FROM ' + objectAPIName; 
    var queryString2 = AppUtils.replaceaNameSpace(queryString).replace(/,,/,',');
    //console.log('// SOQL Query: ' + queryString2);
    cont = 0;
    cont2 = 0;

    AppUtils.startSpinner('Exporting ' + objectAPIName);

    var newHeader = header;

    if(jsonField != null) {

      if(keyNames.length > 1 ){
        for (let index = 0; index < keyNames.length; index++) {
          const element = keyNames[index];
          newHeader += splitChararter + element;
        }
      }

      newHeader += splitChararter + (JSON.stringify(jsonValues)).replace(/\[/g, '').replace(/\]/g, '').replace(/\"/g, "");
      if(typeof jsonValues[jsonValues.length -1] === 'object'){
        var keyValueName = Object.keys(jsonValues[jsonValues.length -1])[0];
        newHeader = newHeader.replace(/\{/g, '').replace(/\}/g, '').replace(keyValueName + ':', '');
      }
    }
    newHeader = newHeader.replace(/,/g, splitChararter).replace(splitChararter+splitChararter, splitChararter);
    //console.log('newHeader: ' + newHeader);
    createFiles.write(('ID' + splitChararter + newHeader + '\r\n'));  
    
    let promise = new Promise((resolve, reject) => {
        conn.query(queryString2)
        .on('record',  function(result) { 
          //console.log('/// RESULT: ' + JSON.stringify(result))
          formatFuntion(result,createFiles,fieldsArray,jsonField,jsonValues);
          cont2++;
          AppUtils.updateSpinnerMessage(' Records Exported: ' + cont2 +' / Records Created: ' + cont);
        })
        .on("queue",  function(batchInfo) {
          AppUtils.log2( objectAPIName + ' - queue' );
        })
        .on("end",  function() {
          var resultData = { exported: cont2 , created: cont };
          resolve(resultData);
        })
        .on('error',  function(err) { 
          AppUtils.log2( objectAPIName + ' - Report Error: ' + err);
          console.log(err.stack);
          //reject(objectAPIName + ' - Error: ' + err );
        })
        .run({ autoFetch : true, maxFetch : 1000000,});     
    });

    var value = await promise;
    AppUtils.stopSpinnerMessage('Done, ' + value['exported'] + ' Exported and ' + value['created'] + ' Created' );
    return value;
  }

  static formatNormallFields(result,fieldsArray) {
    var Id = result['Id'];
    var baseline = Id + splitChararter;
    for(var i = 0; i < fieldsArray.length; i++){
      var newValue = result[fieldsArray[i]];
      if(newValue != null){
        if((String(newValue).includes("{") || String(newValue).includes("}")) && splitChararter != '|'){
          baseline += strinQuote + '<JSONObject>' + strinQuote + splitChararter;
        } else {
          baseline += strinQuote + newValue + strinQuote + splitChararter;
        }
      } else {
        baseline += splitChararter;
      }
    }
    return baseline; 
  }
    
}
