import { flags, SfdxCommand } from '@salesforce/command';
import { Messages } from '@salesforce/core';
import { AppUtils } from '../../../../utils/AppUtils';

// Initialize Messages with the current plugin directory
Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = Messages.loadMessages('vlocityestools', 'epcjsonreport');

const fsExtra = require("fs-extra");

const splitChararter = ',';

export default class epcJsonExport extends SfdxCommand {

  public static description = messages.getMessage('commandDescription');

  public static examples = [
  `$ sfdx vlocityestools:report:epc:epcjsonreport -u myOrg@example.com -p cmt
  `,
  `$ sfdx vlocityestools:report:epc:epcjsonreport  --targetusername myOrg@example.com --package ins
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

    AppUtils.ux = this.ux;
    AppUtils.logInitial(messages.getMessage("command"));
    AppUtils.log3( "EPC Json Report: " + 'Starting Report');
    AppUtils.ux.log(' ');

    try {
      
      var resultData = [];
      const conn = this.org.getConnection();
      
      // ---- Run Reports ----
      await epcJsonExport.doAttributeAssigments(conn,resultData);
      await epcJsonExport.doProduct2(conn,resultData);
      await epcJsonExport.doPCI(conn,resultData);

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

  static async doPCI(conn,resultData) {

    var pciFields = 'Name,'  
    + '%name-space%ChildLineNumber__c,'
    + '%name-space%ChildProductId__c,'
    + '%name-space%ChildRecordType__c,'
    + '%name-space%EligibilityCriteria__c,'
    + '%name-space%GlobalKey__c,'
    + '%name-space%IsRootProductChildItem__c,'
    + '%name-space%MaximumChildItemQuantity__c,'
    + '%name-space%MaxQuantity__c,'
    + '%name-space%MinimumChildItemQuantity__c,'
    + '%name-space%MinMaxDefaultQty__c,'
    + '%name-space%MinQuantity__c,'
    + '%name-space%ParentProductId__c,'
    + '%name-space%Quantity__c,'
    + '%name-space%RelationshipType__c,'
    + '%name-space%SeqNumber__c,'
    + '%name-space%SubParentSpecId__c'

    var pcilHeader = 'Id,'+ AppUtils.replaceaNameSpace(pciFields);

    var resultpciFile = 'ProductChildItemResults.csv';
    var resultpci = await epcJsonExport.exportObject(conn, resultpciFile, '%name-space%ProductChildItem__c', pcilHeader, epcJsonExport.formatPCI, pciFields,null);
    resultData.push({ ObjectName: 'Product Child Item', RecordsExported: resultpci['exported'] , RecordsCreated: resultpci['created'] , ReportFile: resultpciFile });
  
  }

  static async doProduct2(conn,resultData) {
    var product2Fields = 'Name,'   
    + 'Exclude_From_Rating__c,'
    + 'IsActive,'
    + 'ProductCode,'
    + '%name-space%Availability__c,'
    + '%name-space%EligibilityCriteria__c,'
    + '%name-space%EffectiveDate__c,'
    + '%name-space%IsOrderable__c,'
    + '%name-space%RecordTypeName__c,'
    + '%name-space%SellingStartDate__c,'
    + '%name-space%Status__c,'
    + '%name-space%SubType__c,'
    + '%name-space%Term__c,'
    + '%name-space%Type__c'
    var product2BaselHeader = 'Id,'+ AppUtils.replaceaNameSpace(product2Fields);
    var product2lHeader = product2BaselHeader + ',JSONAttributeName,JSONAttributeName.Objectid, JSONAttributeName.attributeid, JSONAttributeName.attributecategoryid, JSONAttributeName.attributeuniquecode,JSONAttributeName.id'
    var resultproduct2File = 'Product2Results.csv';
    var resultproduct2 = await epcJsonExport.exportObject(conn, resultproduct2File, 'Product2', product2lHeader, epcJsonExport.formatProduct2, product2Fields,'%name-space%JSONAttribute__c');
    resultData.push({ ObjectName: 'Product', RecordsExported: resultproduct2['exported'] , RecordsCreated: resultproduct2['created'] , ReportFile: resultproduct2File });
    AppUtils.ux.log(' ');
  }

  static async doAttributeAssigments(conn,resultData) {

    var AAFields = 'Name,'  
    + '%name-space%AttributeCategoryId__c,'
    + '%name-space%AttributeCategorySubType__c,'
    + '%name-space%AttributeDisplayName__c,'
    + '%name-space%AttributeGroupType__c,'
    + '%name-space%AttributeId__c,'
    + '%name-space%CategoryCode__c,'
    + '%name-space%CategoryName__c,'
    + '%name-space%GlobalKey__c,'
    + '%name-space%HasRule__c,'
    + '%name-space%IsActiveAssignment__c,'
    + '%name-space%IsActive__c,'
    + '%name-space%IsConfigurable__c,'
    + '%name-space%IsDynamic__c,'
    + '%name-space%IsEligibilityAttribute__c,'
    + '%name-space%IsRatingAttribute__c,'
    + '%name-space%IsRequired__c,'
    + '%name-space%ObjectId__c,'
    + '%name-space%Value__c'
    var AAHeaderBase = 'Id,' + AppUtils.replaceaNameSpace(AAFields)
    var AAHeaderBaseRuleData = AAHeaderBase + ',rule.expression,rule.ruleType,rule.sourceType,rule.validation'
    var resultAAFileRuleData = 'AttributeAssignmentResultsRuleData.csv';
    var resultAARuleData = await epcJsonExport.exportObject(conn, resultAAFileRuleData, '%name-space%AttributeAssignment__c', AAHeaderBaseRuleData, epcJsonExport.formatAttributeAssigment, AAFields, '%name-space%RuleData__c');
    AppUtils.ux.log(' ');
    
    var AAHeaderBaseValidValuesData = AAHeaderBase + ',ValidValues.displayText,ValidValues.id,ValidValues.isDefault,ValidValues.value'
    var resultAAFileValidValuesData = 'AttributeAssignmentValidValuesData.csv';
    var resultAAValidValuesData = await epcJsonExport.exportObject(conn, resultAAFileValidValuesData, '%name-space%AttributeAssignment__c', AAHeaderBaseValidValuesData, epcJsonExport.formatAttributeAssigment, AAFields, '%name-space%ValidValuesData__c');
    AppUtils.ux.log(' ');
    resultData.push({ ObjectName: 'Attribute Assignment - ValuesData', RecordsExported: resultAAValidValuesData['exported'], RecordsCreated: resultAAValidValuesData['created'], ReportFile: resultAAFileValidValuesData });
    resultData.push({ ObjectName: 'Attribute Assignment - RuleData', RecordsExported: resultAARuleData['exported'], RecordsCreated: resultAARuleData['created'], ReportFile: resultAAFileRuleData });
  }

  static formatGeneric(result,createFiles,fieldsArray) {
    var Id = result['Id'];
    var baseline = Id + splitChararter;
    for(var i = 0; i < fieldsArray.length; i++){
      var newValue = result[fieldsArray[i]];
      if(newValue != null){
        baseline += newValue + splitChararter;
      } else {
        baseline += splitChararter;
      }
    }
    createFiles.write(baseline+'\r\n');  
    return 1; 
  }

  static formatPCI(result,createFiles,fieldsArray) {
    var Id = result['Id'];
    var baseline = Id + splitChararter;
    for(var i = 0; i < fieldsArray.length; i++){
      var newValue = result[fieldsArray[i]];
      //console.log(fieldsArray[i] + ': ' + newValue)
      if(newValue != null){
        if(fieldsArray[i].includes('MinMaxDefaultQty__c') ) {
          baseline += '"' + newValue + '"' + splitChararter;
        } else {
          baseline += newValue + splitChararter;
        }
      } else {
        baseline += splitChararter;
      }
    }
    createFiles.write(baseline+'\r\n');  
    return 1; 
  }

  static formatAttributeAssigment(result,createFiles,fieldsArray,JsonField) {
    var Id = result['Id'];
    var baseline = Id + splitChararter;
    for(var i = 0; i < fieldsArray.length; i++){
      var newValue = result[fieldsArray[i]];
      //console.log(fieldsArray[i] + ': ' + newValue)
      if(newValue != null){
        baseline += newValue + splitChararter;
      } else {
        baseline += splitChararter;
      }
    }

    var cont = 0;
    var jsonData = result[AppUtils.replaceaNameSpace(JsonField)];

    if(jsonData != null && jsonData != '[]' && JsonField == '%name-space%RuleData__c') {
      var ruleData = JSON.parse(jsonData);
      for( var i = 0 ; i < ruleData.length ; i++){
        cont++;
        var rule = ruleData[i];
        //console.log('rule: ' + JSON.stringify(rule));
        var ruleExpression = rule['expression'] != null ? rule['expression'] : '';
        var ruleType = rule['ruleType'] != null ? rule['ruleType'] : '';
        var sourceType = rule['sourceType'] != null ? rule['sourceType'] : '';
        //var validation = rule['validation'] != null ? true : false;
        var validation = rule['validation'] != null;
        var newLine = baseline;
        newLine += ruleExpression + splitChararter;
        newLine += ruleType + splitChararter;
        newLine += sourceType + splitChararter;
        newLine += validation + splitChararter;
        createFiles.write(newLine+'\r\n'); 
      }
    } else if (jsonData != null && jsonData != '[]' &&  JsonField == '%name-space%ValidValuesData__c' ) {
      var validValuesData = JSON.parse(jsonData);
      for( var i = 0 ; i < validValuesData.length ; i++){
        cont++;
        var validValue = validValuesData[i];
        //console.log('validValuesData: ' + JSON.stringify(validValue));
        var displayText = validValue['displayText'] != null ? '"' + validValue['displayText'] + '"': '';
        var id = validValue['id'] != null ? validValue['id'] : '';
        var isDefault = validValue['isDefault'] != null ? validValue['isDefault'] : '';
        var value = validValue['value'] != null ? validValue['value'] : '';  
        var newLine = baseline;
        newLine += displayText + splitChararter;
        newLine += id + splitChararter;
        newLine += isDefault + splitChararter;
        newLine += value + splitChararter;
        createFiles.write(newLine+'\r\n'); 
      }
    } else {
        cont++;
        createFiles.write(baseline+'\r\n');    
    }
    //console.log('/////END ');
    return cont;
  }

  static formatProduct2(result,createFiles,fieldsArray,JsonField) {
    var Id = result['Id'];
    var baseline = Id + splitChararter;
    for(var i = 0; i < fieldsArray.length; i++){
      var newValue = result[fieldsArray[i]];
      //console.log(fieldsArray[i] + ': ' + newValue)
      if(newValue != null){
        baseline += newValue + splitChararter;
      } else {
        baseline += splitChararter;
      }
    }
    var cont = 0;
    var jsonData = result[AppUtils.replaceaNameSpace(JsonField)];
    if(jsonData != null && jsonData != '[]' && JsonField == '%name-space%JSONAttribute__c') {
      var ruleData = JSON.parse(jsonData);
      var keys = Object.keys(ruleData);
      keys.forEach(key => {
        var attribute = ruleData[key];
        for( var i = 0 ; i < attribute.length ; i++){
          cont++;
          var term = attribute[i];
          var objectid = term['objectid__c'] != null ? term['objectid__c'] : '';
          var attributeid = term['attributeid__c'] != null ? term['attributeid__c'] : '';
          var attributecategoryid = term['attributecategoryid__c'] != null ? term['attributecategoryid__c'] : '';
          var attributeuniquecode = term['attributeuniquecode__c'] != null ? term['attributeuniquecode__c'] : '';
          var termid = term['id'] != null ? term['id'] : '';

          var newLine = baseline;
          newLine += key + splitChararter;
          newLine += objectid + splitChararter;
          newLine += attributeid + splitChararter;
          newLine += attributecategoryid + splitChararter;
          newLine += attributeuniquecode + splitChararter;
          newLine += termid + splitChararter;

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

  static async exportObject(conn, resultsFile, Object, header, formatFuntion,fields,JsonField) {
    var objectAPIName = AppUtils.replaceaNameSpace(Object)
    AppUtils.log3( objectAPIName + ' Report, File: ' + resultsFile);

    if (fsExtra.existsSync(resultsFile)) {
      fsExtra.unlinkSync(resultsFile);
    }

    const createFiles = fsExtra.createWriteStream(resultsFile, {flags: 'a'});
    createFiles.write(header+'\r\n');  
    var fieldsArray = AppUtils.replaceaNameSpace(fields).split(',')

    var queryString= 'SELECT ID'
    fieldsArray.forEach(element => {
      queryString += ',' + element;
    });

    if(JsonField != null) {
      queryString += ',' + AppUtils.replaceaNameSpace(JsonField);
    }
    queryString += ' FROM ' + objectAPIName; 
    var queryString2 = AppUtils.replaceaNameSpace(queryString);
    //console.log('queryString2: ' + queryString2);
    var cont = 0;
    var cont2 = 0;

    AppUtils.startSpinner('Exporting ' + objectAPIName);

    let promise = new Promise((resolve, reject) => {
        conn.query(queryString2)
        .on('record',  function(result) { 
          if(JsonField != null) {
            cont += formatFuntion(result,createFiles,fieldsArray,JsonField);
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
    
}
