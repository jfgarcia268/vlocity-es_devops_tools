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

const splitChararter = ',';

export default class epcJsonExport extends SfdxCommand {

  public static description = messages.getMessage('commandDescription');

  public static examples = [
  `$ sfdx vlocityestools:report:epc:epcjsonreport -u myOrg@example.com -p cmt
  `,
  `$ sfdx vlocityestools:report:epc:epcjsonreport --targetusername myOrg@example.com --package ins
  `
  ];

  public static args = [{name: 'file'}];

  protected static flagsConfig = {
    package: flags.string({char: 'p', description: messages.getMessage('packageType')}),
    datafile: flags.string({char: 'd', description: messages.getMessage('dataFile')})
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

    if(packageType == 'cmt'){
      AppUtils.namespace = 'vlocity_cmt__';
    } else if(packageType == 'ins'){
      AppUtils.namespace = 'vlocity_ins__';
    } else {
      throw new Error("Error: -p, --package has to be either cmt or ins ");
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
        // console.log(fields);
        // console.log(jsonFields);
        if(all) {

          var resultFile = ObjectName + '_All_Result.csv';
          var meta  = await conn.sobject(ObjectName).describe();
          var fieldsString = '';
          for (let i = 0; i < meta.fields.length; i++) {
            const objectField = meta.fields[i].name;
            if(objectField != 'Id') {
              fieldsString += objectField + ',';
            }
          }
          fieldsString = fieldsString.substring(0, fieldsString.length - 1);
          //console.log('fieldsString: ' + fieldsString);
          //console.log('resultFile: ' + resultFile);
          if (fsExtra.existsSync(resultFile)) {
            fsExtra.unlinkSync(resultFile);
          }
          var result = await epcJsonExport.exportObject(conn, resultFile, ObjectName, fieldsString, epcJsonExport.formatGeneric, fieldsString,null,null);
          resultData.push({ ObjectName: ObjectName, RecordsExported: result['exported'] , RecordsCreated: result['created'] , ReportFile: resultFile });
          console.log(' ');
        } else if(jsonFields == null) {
          var fieldsString = AppUtils.replaceaNameSpaceFromFile(JSON.stringify(fields)).replace('[', '').replace(']', '').replace(/\"/g, "") + "";
          var resultFile = ObjectName + '_Result.csv';
          //console.log('resultFile: ' + resultFile);
          if (fsExtra.existsSync(resultFile)) {
            fsExtra.unlinkSync(resultFile);
          }
          var result = await epcJsonExport.exportObject(conn, resultFile, ObjectName, fieldsString, epcJsonExport.formatGeneric, fieldsString,null,null);
          resultData.push({ ObjectName: ObjectName, RecordsExported: result['exported'] , RecordsCreated: result['created'] , ReportFile: resultFile });
          console.log(' ');
        } else {
          var fieldsString = AppUtils.replaceaNameSpaceFromFile(JSON.stringify(fields)).replace('[', '').replace(']', '').replace(/\"/g, "") + "" ;
          for (let j = 0; j < Object.keys(jsonFields).length; j++) {
            const jsonField = AppUtils.replaceaNameSpaceFromFile(Object.keys(jsonFields)[j]);
            var resultFile = ObjectName + '_' + jsonField + '_Result.csv';
            if (fsExtra.existsSync(resultFile)) {
              fsExtra.unlinkSync(resultFile);
            }
            var jsonFieldsKeys = jsonFields[Object.keys(jsonFields)[j]];
            if(!JsonwithKeys) {
             var result = await epcJsonExport.exportObject(conn, resultFile, ObjectName, fieldsString, epcJsonExport.formatWithJson, fieldsString,jsonField,jsonFieldsKeys);
            } else {
              var result = await epcJsonExport.exportObject(conn, resultFile, ObjectName, fieldsString, epcJsonExport.formatWithJsonKeys, fieldsString,jsonField,jsonFieldsKeys);
            }
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
        jsonValues.forEach(jsonValue => {
          var value = term[jsonValue] != null ? term[jsonValue] : '';
          newLine += '"' + value + '"' + splitChararter;
        });

        createFiles.write(newLine+'\r\n'); 
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
    createFiles.write(baseline+'\r\n'); 
    return 1; 
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
          cont++;
          var term = attribute[i];
          cont++;
          var newLine = baseline + key + splitChararter ;
          jsonValues.forEach(jsonValue => {
            var value = term[jsonValue] != null ? term[jsonValue] : '';
            newLine += '"' + value + '"' + splitChararter;
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

  static async exportObject(conn, resultsFile, Object, header, formatFuntion,fields,jsonField,jsonValues) {
    var objectAPIName = AppUtils.replaceaNameSpace(Object)
    AppUtils.log3( objectAPIName + ' Report, File: ' + resultsFile);

    if (fsExtra.existsSync(resultsFile)) {
      fsExtra.unlinkSync(resultsFile);
    }

    const createFiles = fsExtra.createWriteStream(resultsFile, {flags: 'a'});
    var fieldsArray = AppUtils.replaceaNameSpace(fields).split(',')

    var queryString= 'SELECT ID'
    fieldsArray.forEach(element => {
      queryString += ',' + element;
    });

    if(jsonField != null) {
      queryString += ',' + AppUtils.replaceaNameSpace(jsonField);
    }
    queryString += ' FROM ' + objectAPIName; 
    var queryString2 = AppUtils.replaceaNameSpace(queryString);
    //console.log('// SOQL Query: ' + queryString2);
    var cont = 0;
    var cont2 = 0;

    AppUtils.startSpinner('Exporting ' + objectAPIName);

    if(jsonField != null) {
      var newHeader = header;
      if(formatFuntion.name == 'formatWithJsonKeys'){
        newHeader += ',KEY';
      }
      newHeader += splitChararter + (JSON.stringify(jsonValues)).replace('[', '').replace(']', '').replace(/\"/g, "")
      createFiles.write('ID,' + newHeader+'\r\n');  
    }
    else {
      createFiles.write('ID,' + header+'\r\n');  
    }

    let promise = new Promise((resolve, reject) => {
        conn.query(queryString2)
        .on('record',  function(result) { 
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
    var Id = result['Id'];
    var baseline = Id + splitChararter;
    for(var i = 0; i < fieldsArray.length; i++){
      var newValue = result[fieldsArray[i]];
      if(newValue != null){
        try {
          JSON.parse(newValue);
          if (typeof newValue === "boolean"){
            baseline += '"' + newValue + '"' + splitChararter;
          } else {
            baseline += '"' + 'JSONObject' + '"' + splitChararter;
          }
        } catch (e) {
          baseline += '"' + newValue + '"' + splitChararter;
        }   
      } else {
        baseline += splitChararter;
      }
    }
    return baseline; 
  }
    
}
