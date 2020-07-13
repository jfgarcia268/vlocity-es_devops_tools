import { flags, SfdxCommand } from '@salesforce/command';
import { Messages, SfdxError } from '@salesforce/core';
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
    
    AppUtils.logInitial(messages.getMessage("command"));

    try {

      const conn = this.org.getConnection();

      AppUtils.log3( "EPC Json Report: " + 'Starting Report');
     
      await epcJsonExport.attributeAssigment(conn,'AAResults.csv');
    
      await epcJsonExport.product2(conn,'Product2Results.csv');

    } catch (e) {
        console.log(e); 
    }

  }

  static async attributeAssigment(conn, resultsFile) {

    var splitChararter = ','

    AppUtils.log3( 'AttributeAssigment Report, File: ' + resultsFile);

    if (fsExtra.existsSync(resultsFile)) {
      fsExtra.unlinkSync(resultsFile);
    }

    const createFiles = fsExtra.createWriteStream(resultsFile, {flags: 'a'});
    var initialHeader = 'Id,ObjectId,AttributeId,ruleType,ruleExpression';
    createFiles.write(initialHeader+'\r\n');  

    var objectIdF = AppUtils.replaceaNameSpace('%name-space%ObjectId__c');
    var attributeIdF = AppUtils.replaceaNameSpace('%name-space%AttributeId__c');
    var ruleDataF= AppUtils.replaceaNameSpace('%name-space%RuleData__c');

    var queryString= 'SELECT Id, '
                   + objectIdF + ', '
                   + attributeIdF + ', '
                   + ruleDataF +  ' '
                   + 'FROM %name-space%AttributeAssignment__c ';
    var queryString2 = AppUtils.replaceaNameSpace(queryString);

    //console.log('queryString: ' + queryString2);

    var cont = 0;

    let promise = new Promise((resolve, reject) => {
        conn.query(queryString2)
        .on('record',  function(result) { 
        cont ++;
        var Id = result['Id'];
        var objectId = result[objectIdF];
        var attributeId = result[attributeIdF];
        var ruleDataJson = result[ruleDataF];

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
        })
        .on("queue",  function(batchInfo) {
            AppUtils.log2( 'AttributeAssigment - queue' );
        })
        .on("end",  function() {
            AppUtils.log2( 'AttributeAssigment - Number of AttributeAssigment Exported: ' + cont );
            resolve(true);
        })
        .on('error',  function(err) { 
            AppUtils.log3( 'AttributeAssigment - Error: ' + err );
            reject(false);
        })
        .run({ autoFetch : true, maxFetch : 1000000 });     
    });

    await promise;
  }

  static async product2(conn, resultsFile) {
    AppUtils.log3( 'Product2 Report, File: ' + resultsFile);

    var splitChararter = ','

    if (fsExtra.existsSync(resultsFile)) {
      fsExtra.unlinkSync(resultsFile);
    }

    const createFiles = fsExtra.createWriteStream(resultsFile, {flags: 'a'});

    var idF = 'Id';
    var nameF = 'Name';
    var productCodeF= 'ProductCode';

    var initialHeader = 'Id,Name,ProductCode';

    createFiles.write(initialHeader+'\r\n');  

    var queryString= 'SELECT '
                    + idF + ', '
                    + nameF + ', '
                    + productCodeF + ' '
                    + 'FROM  Product2';
    var queryString2 = AppUtils.replaceaNameSpace(queryString);

    //console.log('queryString: ' + queryString2);

    var cont = 0;

    let promise = new Promise((resolve, reject) => {
        conn.query(queryString2)
        .on('record',  function(result) { 
        cont ++;

        var Id = result['Id'];
        var name = result['Name'];
        var productCode= result['ProductCode'];
        // if(ruleDataJson != undefined && ruleDataJson != "" && ruleDataJson != "[]" ) {
        //     ruleData = JSON.parse(ruleDataJson);
        //     for( i = 0 ; i < ruleData.length ; i++){
        //         var rule = ruleData[i];
        //         var ruleExpression = rule['expression'];
        //         var ruleType = rule['ruleType'];
        //         //console.log('ruleExpression: ' + ruleExpression + '  ruleType: ' + ruleType);
        //         var newLine = Id + splitChararter + objectId + splitChararter + attributeId + splitChararter + ruleExpression + splitChararter + ruleType;
        //         createFiles.write(newLine+'\r\n');  
        //     }
        // } else {
        var newLine = Id + splitChararter + name + splitChararter + productCode;
        createFiles.write(newLine+'\r\n');    
        // }
        })
        .on("queue",  function(batchInfo) {
          AppUtils.log2( 'Product2 - queue' );
        })
        .on("end",  function() {
            AppUtils.log2( 'Product2 - Number of Products Exported: ' + cont );
            resolve(true);
        })
        .on('error',  function(err) { 
            AppUtils.log3( 'Product2 - Error: ' + err );
            reject(false);
        })
        .run({ autoFetch : true, maxFetch : 1000000 }); 
      });

    await promise;
  }
    
}
