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
        var ObjectName = AppUtils.replaceaNameSpaceFromFile(element);
        var all = doc.Objects[element]['All'];
        var fields = doc.Objects[element]['Fields'];
        var jsonFields = doc.Objects[element]['JsonFields'];
        var JsonwithKeys = doc.Objects[element]['JsonwithKeys'];
        var JsonwithKeys2 = doc.Objects[element]['JsonwithKeys2'];
        var onlyJson = doc.Objects[element]['OnlyJsonFields'];
        var fieldsString = '';
        // console.log(fields);
        // console.log(jsonFields);
        if(all) {
          var meta  = await conn.sobject(ObjectName).describe();
          for (let i = 0; i < meta.fields.length; i++) {
            const objectField = meta.fields[i].name;
            if(objectField != 'Id') {
              fieldsString += objectField + splitChararter;
            }
          }
          fieldsString = fieldsString.substring(0, fieldsString.length - 1);
        } 

        if (jsonFields == null) {
          if(!all) {
            fieldsString = AppUtils.replaceaNameSpaceFromFile(JSON.stringify(fields)).replace('[', '').replace(']', '').replace(/\"/g, "") + "";
          }
            var resultFile = ObjectName + '_Result.csv';
          //console.log('resultFile: ' + resultFile);
          if (fsExtra.existsSync(resultFile)) {
            fsExtra.unlinkSync(resultFile);
          }
          var result = await epcJsonExport.exportObject(conn, resultFile, ObjectName, fieldsString, epcJsonExport.formatGeneric, fieldsString,null,null,all,onlyJson);
          resultData.push({ ObjectName: ObjectName, RecordsExported: result['exported'] , RecordsCreated: result['created'] , ReportFile: resultFile });
          console.log(' ');
        } else {
            if(!all && fields!= null) {
              fieldsString = AppUtils.replaceaNameSpaceFromFile(JSON.stringify(fields)).replace('[', '').replace(']', '').replace(/\"/g, "") + "" ;
            } 
            for (let j = 0; j < Object.keys(jsonFields).length; j++) {
              const jsonField = AppUtils.replaceaNameSpaceFromFile(Object.keys(jsonFields)[j]);
              var resultFile = ObjectName + '_' + jsonField + '_Result.csv';
              if (fsExtra.existsSync(resultFile)) {
                fsExtra.unlinkSync(resultFile);
              }
              var jsonFieldsKeys = jsonFields[Object.keys(jsonFields)[j]];

              var formatFuntion = epcJsonExport.formatWithJson;

              if(JsonwithKeys) {
                formatFuntion = epcJsonExport.formatWithJsonKeys;
              } else if(JsonwithKeys2){
                formatFuntion = epcJsonExport.formatWithJsonKeys2;
              } 
              //console.log('formatFuntion:' + formatFuntion);
              var result = await epcJsonExport.exportObject(conn, resultFile, ObjectName, fieldsString, formatFuntion, fieldsString,jsonField,jsonFieldsKeys,all,onlyJson);

              resultData.push({ ObjectName: ObjectName + ' - ' + jsonField, RecordsExported: result['exported'] , RecordsCreated: result['created'] , ReportFile: resultFile });
              console.log(' ');
            }
        }
      }

      var tableColumnData = ['ObjectName', 'RecordsExported', 'RecordsCreated', 'ReportFile']; 

      AppUtils.ux.log(' ');
      AppUtils.ux.log('RESULTS:');
      AppUtils.ux.log(' ');
      AppUtils.ux.table(resultData, tableColumnData);
      AppUtils.ux.log(' ');

    } catch (e) {
        console.log(e); 
    }
  }

  static formatWithJson(result,createFiles,fieldsArray,jsonField,jsonValues) {
    var baseline = epcJsonExport.formatNormallFields(result,fieldsArray);
    var cont = 0;
    var jsonData = result[AppUtils.replaceaNameSpace(jsonField)];
    if(jsonData != null && jsonData != '[]') {
      var data = JSON.parse(jsonData);
      for( var i = 0 ; i < data.length ; i++){
        cont++;
        var term = data[i];
        var newLine = baseline;

        var loopLimit = jsonValues.length;
        var secondLevelArray;
        if(typeof jsonValues[jsonValues.length -1] === 'object'){
          loopLimit = loopLimit - 1;
          secondLevelArray = AppUtils.getDataByPath(term,Object.keys(jsonValues[jsonValues.length -1])[0]);
        }
        for (let index = 0; index < loopLimit; index++) {
          const jsonElement = jsonValues[index];
          //console.log('// jsonValue: ' + jsonValue + ' Value: ' + AppUtils.getDataByPath(term, jsonValue) );
          var value = AppUtils.getDataByPath(term, jsonElement);
          var valueResult = value? value : '';
          newLine += strinQuote + valueResult + strinQuote + splitChararter;
        }

        if(secondLevelArray && secondLevelArray.length > 0) {
          //console.log('//////secondLevelArray: ' + JSON.stringify(secondLevelArray));
          for (const secondLevelObjectIndex in secondLevelArray) {
            var secondLevelObject = secondLevelArray[secondLevelObjectIndex];
            //console.log('//secondLevelObject: ' + JSON.stringify(secondLevelObject));
            var secondLevelLine = '';
            var secodLevelKeys = jsonValues[jsonValues.length -1][Object.keys(jsonValues[jsonValues.length -1])[0]];
            //console.log('secodLevelKeys: ' + JSON.stringify(secodLevelKeys));
            for (let index = 0; index < secodLevelKeys.length; index++) {
              var key = secodLevelKeys[index];
              var value = secondLevelObject[key];
              var valueResult = value? value : '';
              //console.log('value: ' + valueResult + ' key: ' + key);
              secondLevelLine += strinQuote + valueResult + strinQuote + splitChararter;
            }
            //console.log('secondLevelLine: ' + secondLevelLine);
            createFiles.write(newLine + secondLevelLine + '\r\n'); 
          }
        }
        else {
          createFiles.write(newLine + '\r\n'); 
        }
      }
    } else {
        cont++;
        createFiles.write(baseline+'\r\n');    
    }
    //console.log('/////END ');
    return cont;
  }

  static formatGeneric(result,createFiles,fieldsArray) {
    var baseline = epcJsonExport.formatNormallFields(result,fieldsArray);
    //console.log('// BASELINE: ' + baseline);
    createFiles.write(baseline+'\r\n'); 
    return 1; 
  }

  static formatWithJsonKeys2(result,createFiles,fieldsArray,JsonField,jsonValues) {
    var baseline = epcJsonExport.formatNormallFields(result,fieldsArray);
    var cont = 0;
    var jsonData = result[AppUtils.replaceaNameSpace(JsonField)];
    if(jsonData != null && jsonData != '[]') {
      var ruleData = JSON.parse(jsonData);
      var keys = Object.keys(ruleData);
      keys.forEach(key => {
        var attribute = ruleData[key];
        var keys2 = Object.keys(attribute);
        keys2.forEach(key2 => {
          var attribute2 = attribute[key2];
          if(Array.isArray(attribute2)) {
            for( var i = 0 ; i < attribute2.length ; i++){
              var term = attribute2[i];
              var newLine = baseline + key + splitChararter+ key2 + splitChararter ;
              jsonValues.forEach(jsonValue => {
                var value = term[jsonValue] != null ? term[jsonValue] : '';
                newLine += strinQuote + value + strinQuote + splitChararter;
              });
              createFiles.write(newLine+'\r\n'); 
              cont++;
            }
          } else {
            var keys3 = Object.keys(attribute2);
            keys3.forEach(key3 => {
              var term = attribute2[key3];
              var newLine = baseline + key + splitChararter+ key2 + splitChararter ;
              jsonValues.forEach(jsonValue => {
                var value = term[jsonValue] != null ? term[jsonValue] : '';
                newLine += strinQuote + value + strinQuote + splitChararter;
              });
              createFiles.write(newLine+'\r\n'); 
              cont++;
            });
          }
        });
      });
    } else {
        cont++;
        createFiles.write(baseline+'\r\n');    
    }
    //console.log('/////END ');
    return cont;
  }

  static formatWithJsonKeys(result,createFiles,fieldsArray,JsonField,jsonValues) {
    var baseline = epcJsonExport.formatNormallFields(result,fieldsArray);
    var cont = 0;
    var jsonData = result[AppUtils.replaceaNameSpace(JsonField)];
    if(jsonData != null && jsonData != '[]') {
      var ruleData = JSON.parse(jsonData);
      var keys = Object.keys(ruleData);
      keys.forEach(key => {
        var attribute = ruleData[key];
        for( var i = 0 ; i < attribute.length ; i++){
          var term = attribute[i];
          cont++;
          var newLine = baseline + key + splitChararter ;
          jsonValues.forEach(jsonValue => {
            var value = term[jsonValue] != null ? term[jsonValue] : '';
            newLine += strinQuote + value + strinQuote + splitChararter;
          });
          createFiles.write(newLine+'\r\n'); 
        }
      });
    } else {
        cont++;
        createFiles.write(baseline+'\r\n');    
    }
    //console.log('/////END ');
    return cont;
  }

  static async exportObject(conn, resultsFile, ObjectName, header, formatFuntion,fields,jsonField,jsonValues,all,onlyJson) {
    var objectAPIName = AppUtils.replaceaNameSpace(ObjectName);
    AppUtils.log3( objectAPIName + ' Report, File: ' + resultsFile);

    if (fsExtra.existsSync(resultsFile)) {
      fsExtra.unlinkSync(resultsFile);
    }

    const createFiles = fsExtra.createWriteStream(resultsFile, {flags: 'a'});
    var fieldsArray = AppUtils.replaceaNameSpace(fields).split(',');
    
    var queryString= 'SELECT ID'
    if(!onlyJson) {
      fieldsArray.forEach(element => {
        queryString += ',' + element;
      });
    }
    
    if(jsonField != null && !all) {
      queryString += ',' + AppUtils.replaceaNameSpace(jsonField);
    }
    queryString += ' FROM ' + objectAPIName; 
    var queryString2 = AppUtils.replaceaNameSpace(queryString);
    //console.log('// SOQL Query: ' + queryString2);
    var cont = 0;
    var cont2 = 0;

    AppUtils.startSpinner('Exporting ' + objectAPIName);

    var newHeader = header;

    if(jsonField != null) {
      if(formatFuntion.name == 'formatWithJsonKeys'){
        newHeader += splitChararter + 'KEY';
      }
      if(formatFuntion.name == 'formatWithJsonKeys2'){
        newHeader += splitChararter + 'KEY' + splitChararter + 'KEY_2';
      }
      newHeader += splitChararter + (JSON.stringify(jsonValues)).replace(/\[/g, '').replace(/\]/g, '').replace(/\"/g, "");
      if(typeof jsonValues[jsonValues.length -1] === 'object'){
        var keyValueName = Object.keys(jsonValues[jsonValues.length -1])[0];
        newHeader = newHeader.replace(/\{/g, '').replace(/\}/g, '').replace(keyValueName + ':', '');
      }
    }
    newHeader = newHeader.replace(/,/g, splitChararter).replace(splitChararter+splitChararter, splitChararter);
    console.log('newHeader: ' + newHeader);
    createFiles.write(('ID' + splitChararter + newHeader + '\r\n'));  
    
    let promise = new Promise((resolve, reject) => {
        conn.query(queryString2)
        .on('record',  function(result) { 
          //console.log('/// RESULT: ' + JSON.stringify(result))
          if(jsonField != null) {
            cont += formatFuntion(result,createFiles,fieldsArray,jsonField,jsonValues);
          }
          else {
            cont += formatFuntion(result,createFiles,fieldsArray);
          }
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
          AppUtils.log2( objectAPIName + ' - Report Error');
          reject(objectAPIName + ' - Error: ' + err );
        })
        .run({ autoFetch : true, maxFetch : 1000000,});     
    });

    var value = await promise;
    AppUtils.stopSpinnerMessage('Done, ' + value['exported'] + ' Exported and ' + value['created'] + ' Created' );
    return value;
  }

  static formatNormallFields(result,fieldsArray) {
    //console.log('NUM fieldsArray:' + fieldsArray.length);
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
