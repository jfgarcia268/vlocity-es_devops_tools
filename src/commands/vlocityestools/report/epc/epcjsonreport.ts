import { flags, SfdxCommand} from '@salesforce/command';
import { Messages } from '@salesforce/core';
import { AppUtils } from '../../../../utils/AppUtils';

// Initialize Messages with the current plugin directory
Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = Messages.loadMessages('vlocityestools', 'epcjsonreport');

const fsExtra = require("fs-extra");

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

    try {
      const conn = this.org.getConnection();

      AppUtils.log3( "EPC Json Report: " + 'Starting Report');

      var AAHeader = 'Id,ObjectId,AttributeId,ruleType,ruleExpression';
      var AAFields ='%name-space%ObjectId__c,%name-space%AttributeId__c,%name-space%RuleData__c';
      var resultAAFile = 'AAResults.csv';
      var resultAA = await epcJsonExport.exportObject(conn, resultAAFile, '%name-space%AttributeAssignment__c',AAHeader ,epcJsonExport.formatAttributeAssigment ,AAFields);


      var product2lHeader = 'Id,Name,ProductCode';
      var product2Fields ='Name,ProductCode';
      var resultproduct2File = 'AAResults.csv';
      var resultproduct2 = await epcJsonExport.exportObject(conn, resultproduct2File, 'Product2', product2lHeader ,epcJsonExport.formatProduct2 ,product2Fields);


      AppUtils.log3('Final Report:');
      AppUtils.log3(resultAA + ' File: ' + resultAAFile);
      AppUtils.log3(resultproduct2 + ' File: ' + resultproduct2File);

    } catch (e) {
        console.log(e); 
    }

  }


  static formatAttributeAssigment(result,createFiles,fieldsArray) {
    var splitChararter = ','

    var Id = result['Id'];
    var objectId = result[fieldsArray[0]];
    var attributeId = result[fieldsArray[1]];
    var ruleDataJson = result[fieldsArray[2]];
    
    if(ruleDataJson != undefined && ruleDataJson != "" && ruleDataJson != "[]" ) {
        var ruleData = JSON.parse(ruleDataJson);
        for( var i = 0 ; i < ruleData.length ; i++){
            var rule = ruleData[i];
            var ruleExpression = rule['expression'];
            var ruleType = rule['ruleType'];
            //console.log('ruleExpression: ' + ruleExpression + '  ruleType: ' + ruleType);
            var newLine = Id + splitChararter + objectId + splitChararter + attributeId + splitChararter + ruleType + splitChararter + ruleExpression;
            createFiles.write(newLine+'\r\n');  
        }
    } else {
        var newLine = Id + splitChararter + objectId + splitChararter + attributeId;
        createFiles.write(newLine+'\r\n');    
    }
  }

  static formatProduct2(result,createFiles,fieldsArray) {
    var splitChararter = ','
    var Id = result['Id'];
    var name = result[fieldsArray[0]];
    var productCode= result[fieldsArray[1]];

    var newLine = Id + splitChararter + name + splitChararter + productCode;
    createFiles.write(newLine+'\r\n'); 
  }

  static async exportObject(conn, resultsFile, Object, header, formatFuntion,fields) {

    var objectAPIName = AppUtils.replaceaNameSpace(Object);

    AppUtils.log3( objectAPIName + ' Report, File: ' + resultsFile);

    if (fsExtra.existsSync(resultsFile)) {
      fsExtra.unlinkSync(resultsFile);
    }

    AppUtils.startSpinner('Exporting ' + objectAPIName);

    const createFiles = fsExtra.createWriteStream(resultsFile, {flags: 'a'});
    createFiles.write(header+'\r\n');  

    var fieldsArray = fields.split(',')

    var queryString= 'SELECT ID'
    fieldsArray.forEach(element => {
      queryString += ',' + element;
    });
    queryString += ' FROM ' + Object; 

    var queryString2 = AppUtils.replaceaNameSpace(queryString);

    //console.log('queryString: ' + queryString2);

    var cont = 0;

    let promise = new Promise((resolve, reject) => {
        conn.query(queryString2)
        .on('record',  function(result) { 
        cont ++;

        formatFuntion(result,createFiles,fieldsArray);
        
        })
        .on("queue",  function(batchInfo) {
            AppUtils.log2( Object + ' - queue' );
        })
        .on("end",  function() {
            AppUtils.log2( Object + ' - Report Done');
            resolve('Number of' + Object + ': ' + cont);
        })
        .on('error',  function(err) { 
            AppUtils.log2( Object + ' - Report Error');
            reject(Object + ' - Error: ' + err );
        })
        .run({ autoFetch : true, maxFetch : 1000000 });     
    });

    var value = await promise;
    AppUtils.stopSpinnerMessage('Done, ' + cont + ' Exported');
    return value;
  }
    
}
