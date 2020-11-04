import { flags, SfdxCommand } from '@salesforce/command';
import { Messages, SfdxError, Org } from '@salesforce/core';
import { AppUtils } from '../../../utils/AppUtils';

// Initialize Messages with the current plugin directory
Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = Messages.loadMessages('vlocityestools', 'attributegkfix');

export default class attributeAssigmentGKFix extends SfdxCommand {

  public static description = messages.getMessage('commandDescription');

  private static batchSize = 10000;

  public static examples = [
  `$ sfdx vlocityestools:report:epc:attributegkfix -s myOrg@example.com -t myOrg2@example.com  -p cmt
  `,
  `$ sfdx vlocityestools:report:epc:attributegkfix --targetusername myOrg@example.com --package ins --datafile data.yaml
  `
  ];

  public static args = [{name: 'file'}];

  protected static flagsConfig = {
    package: flags.string({char: 'p', description: messages.getMessage('packageType')}),
    objectid: flags.string({char: 'i', description: messages.getMessage('objectid')}),
    source: flags.string({char: 's', description: messages.getMessage('source')}),
    target: flags.string({char: 't', description: messages.getMessage('target')})
  };

  // Comment this out if your command does not require an org username
  protected static requiresUsername = false;

  // Comment this out if your command does not support a hub org username
  //protected static supportsDevhubUsername = true;

  // Set this to true if your command requires a project workspace; 'requiresProject' is false by default
  //protected static requiresProject = false;

  public async run() {

    var packageType = this.flags.package;
    var source = this.flags.source;
    var target = this.flags.target;

    AppUtils.ux = this.ux;
    AppUtils.logInitial(messages.getMessage("command"));
    AppUtils.ux.log(' ');

    const org1: Org = await Org.create({ aliasOrUsername: source });
    const connSource = org1.getConnection();

    const org2: Org = await Org.create({ aliasOrUsername: target });
    const connTarget = org2.getConnection();

    var nameSpaceSet = await AppUtils.setNameSpace(connSource,packageType);
    //console.log('nameSpaceSet: ' + nameSpaceSet);
    if(!nameSpaceSet){
      throw new SfdxError("Error: Package was not set or incorrect was provided.");
    }
    AppUtils.log2('Creating Products Maps'); 
    AppUtils.log2('Source:'); 
    var sourceProduct2Map = await attributeAssigmentGKFix.createProduct2Map(connSource);
    AppUtils.log2('Target:'); 
    var targetProduct2Map = await attributeAssigmentGKFix.createProduct2Map(connTarget);
    //console.log('TEST: ' + targetProduct2Map.get('01t5o000000Ead3AAC'))
    AppUtils.ux.log(' ');
    await attributeAssigmentGKFix.fixNonOverrideAA(connSource,connTarget,sourceProduct2Map,targetProduct2Map);
    AppUtils.ux.log(' ');
    await attributeAssigmentGKFix.fixOverrideAA(connSource,connTarget);
    
  }

  static async cleanStaleAA(connSource, connTarget) {

  }

  static async createProduct2Map(conn) {
    var queryString= 'SELECT Id, %name-space%GlobalKey__c FROM Product2';
    var products = await attributeAssigmentGKFix.query(conn,queryString);
    let map = new Map();
    for (let index = 0; index < products.length; index++) {
      const element = products[index];
      var productid = element.Id;
      var gk = element[AppUtils.replaceaNameSpace('%name-space%GlobalKey__c')];
      //console.log('Id: ' + productid + ' gk: ' + gk);
      map.set(productid, gk);
    }
    return map;
  }

  static async createAAOverrideMap(conn) {
    var queryString= "SELECT ID, %name-space%GlobalKey__c FROM %name-space%AttributeAssignment__c WHERE %name-space%IsOverride__c = true";
    var products = await attributeAssigmentGKFix.query(conn,queryString);
    let map = new Map();
    for (let index = 0; index < products.length; index++) {
      const element = products[index];
      var aaid = element.Id;
      //console.log('Id: ' + productid + ' gk: ' + gk);
      map.set(aaid, element);
    }
    return map;
  }


  static async fixOverrideAA(connSource,connTarget) {

    AppUtils.log3('Fixing Override AA - records will be matched by Matching OverrideDefintions'); 
    AppUtils.log2('Creating Attribute Assigment Maps'); 
    AppUtils.log2('Source: '); 
    var sourceAAMap = await attributeAssigmentGKFix.createAAOverrideMap(connSource);
    AppUtils.log2('Target: '); 
    var targetAAMap = await attributeAssigmentGKFix.createAAOverrideMap(connTarget);
    AppUtils.ux.log(' ');
    
    var queryString = "SELECT ID, %name-space%ProductHierarchyGlobalKeyPath__c,%name-space%ProductId__c, %name-space%PromotionId__c,%name-space%PromotionItemId__c, %name-space%OverriddenAttributeAssignmentId__c, %name-space%OverridingAttributeAssignmentId__c, %name-space%OverrideType__c,%name-space%OverridingAttributeAssignmentId__r.%name-space%AttributeId__r.%name-space%Code__c "
    queryString += "FROM %name-space%OverrideDefinition__c "
    queryString += "WHERE %name-space%OverrideType__c = 'Attribute' AND %name-space%OverridingAttributeAssignmentId__c != null AND %name-space%OverriddenAttributeAssignmentId__c != null "
    
    AppUtils.log2('Fetching Override Definitions records from Source'); 
    var sourceOO = await attributeAssigmentGKFix.query(connSource,queryString);
    var sourceOOMap = attributeAssigmentGKFix.createMapforOverrideDefinitions(sourceOO);
    AppUtils.log2('Fetching Override Definitions records from Target'); 
    var targetOO = await attributeAssigmentGKFix.query(connTarget,queryString);
    var targetOOMap = attributeAssigmentGKFix.createMapforOverrideDefinitions(targetOO);
    AppUtils.ux.log(' ');

    var recordsToUpdate = [];
    AppUtils.log2('Matching AA by using OverrideDefintions'); 
    for (let [key, object] of sourceOOMap) {
      //console.log(key + " = " + JSON.stringify(object));
      var targetObject = targetOOMap.get(key);
      //console.log('targetObject: ' + targetObject);
      if(targetObject){
        var sourceOverridingAttributeAssignmentID = object[AppUtils.replaceaNameSpace('%name-space%OverridingAttributeAssignmentId__c')]; 
        var targetOverridingAttributeAssignmentID = targetObject[AppUtils.replaceaNameSpace('%name-space%OverridingAttributeAssignmentId__c')];
        //console.log('sourceOverridingAttributeAssignmentID: ' + sourceOverridingAttributeAssignmentID + '  targetOverridingAttributeAssignmentID: ' + targetOverridingAttributeAssignmentID);
        var sourceOverridingAttributeAssignment = sourceAAMap.get(sourceOverridingAttributeAssignmentID); 
        var targetOverridingAttributeAssignment = targetAAMap.get(targetOverridingAttributeAssignmentID);   
        //console.log('sourceOverridingAttributeAssignment: ' + sourceOverridingAttributeAssignment + '  targetOverridingAttributeAssignment: ' + targetOverridingAttributeAssignment);

        if(sourceOverridingAttributeAssignment && targetOverridingAttributeAssignment){
          var sourceOverridingAttributeAssignmentGK = sourceOverridingAttributeAssignment[AppUtils.replaceaNameSpace('%name-space%GlobalKey__c')];
          var targetOverridingAttributeAssignmentGK = targetOverridingAttributeAssignment[AppUtils.replaceaNameSpace('%name-space%GlobalKey__c')];
          //console.log('sourceOverridingAttributeAssignmentGK: ' + sourceOverridingAttributeAssignmentGK + '  targetOverridingAttributeAssignmentGK: ' + targetOverridingAttributeAssignmentGK);
          if(sourceOverridingAttributeAssignmentGK != targetOverridingAttributeAssignmentGK) {
            AppUtils.log2('Mismatch - Related IDs Source: ' + sourceOverridingAttributeAssignment.Id + ' Target: ' +  targetOverridingAttributeAssignment.Id  ); 
            targetOverridingAttributeAssignment[AppUtils.replaceaNameSpace('%name-space%GlobalKey__c')] = sourceOverridingAttributeAssignmentGK;
            //delete targetObject[AppUtils.replaceaNameSpace('%name-space%OverridingAttributeAssignmentId__r.%name-space%AttributeId__r.%name-space%Code__c')];
            recordsToUpdate.push(targetOverridingAttributeAssignment);
            //console.log(JSON.stringify(targetOverridingAttributeAssignment));
          }
        }
      }
    }
    if(recordsToUpdate.length > 0){
      await attributeAssigmentGKFix.updateRows(recordsToUpdate,connTarget,AppUtils.replaceaNameSpace('%name-space%AttributeAssignment__c'));
    }
    else {
      AppUtils.log2('No Records to update'); 
    }
  }

  static createMapforOverrideDefinitions(records){
    let map = new Map();
    for (let index = 0; index < records.length; index++) {
      const element = records[index];
      var key = '';
      key += '|' + element[AppUtils.replaceaNameSpace('%name-space%ProductHierarchyGlobalKeyPath__c')];
      key += '|' + element[AppUtils.replaceaNameSpace('%name-space%ProductId__c')];
      key += '|' + element[AppUtils.replaceaNameSpace('%name-space%PromotionId__c')];
      key += '|' + element[AppUtils.replaceaNameSpace('%name-space%PromotionItemId__c')];
      key += '|' + element[AppUtils.replaceaNameSpace('%name-space%OverridingAttributeAssignmentId__r.%name-space%AttributeId__r.%name-space%Code__c')];
      map.set(key, element);
    }
    return map;
  }

  static async fixNonOverrideAA(connSource,connTarget,sourceProduct2Map,targetProduct2Map) {
    AppUtils.log3('Fixing Non Override AA - records will be matched by AttributeId and ObjectId'); 
    var queryString= "SELECT ID, %name-space%AttributeId__r.%name-space%GlobalKey__c, %name-space%ObjectId__c, %name-space%GlobalKey__c FROM %name-space%AttributeAssignment__c WHERE %name-space%ObjectType__c= 'Product2' AND %name-space%IsOverride__c = false";
    AppUtils.log2('Fetching AA records from Source'); 
    var sourceAA = await attributeAssigmentGKFix.query(connSource,queryString);
    var sourceAAMap = attributeAssigmentGKFix.createMapforNonAA(sourceAA,sourceProduct2Map);
    AppUtils.log2('Fetching AA records from Target'); 
    var targetAA = await attributeAssigmentGKFix.query(connTarget,queryString);
    var targetAAMap = attributeAssigmentGKFix.createMapforNonAA(targetAA,targetProduct2Map);
    AppUtils.ux.log(' ');

    AppUtils.log2('Matching by AttributeId and ObjectId...'); 
    var recordsToUpdateSource = [];
    var recordsToUpdate = [];
    for (let [key, objectArray] of sourceAAMap) {
      var object = objectArray[0];
      if(objectArray.length > 1) {
        var sourcegk = object[AppUtils.replaceaNameSpace('%name-space%GlobalKey__c')];
        for (let index = 1; index < objectArray.length; index++) {
          var duplicateObjectToUpdate = objectArray[index];
          duplicateObjectToUpdate[AppUtils.replaceaNameSpace('%name-space%GlobalKey__c')] = sourcegk;
          delete duplicateObjectToUpdate[AppUtils.replaceaNameSpace('%name-space%AttributeId__r.%name-space%GlobalKey__c')];
          AppUtils.log2('Duplicated Found - Records Will be Updated with Same GlobalKey if necessary - Global Key: ' + sourcegk ); 
          recordsToUpdateSource.push(duplicateObjectToUpdate); 
        }
      } 
      //console.log(key + " = " + object);
      var targetObjects = targetAAMap.get(key);
      //console.log('targetObject: ' + targetObject);
      if(targetObjects) {
        for (let index = 0; index < targetObjects.length; index++) {
          const targetObject = targetObjects[index];
          var sourcegk = object[AppUtils.replaceaNameSpace('%name-space%GlobalKey__c')];
          var targetgk = targetObject[AppUtils.replaceaNameSpace('%name-space%GlobalKey__c')];
          //console.log(sourcegk + " =? " + targetgk);
          if(sourcegk != targetgk) {
            AppUtils.log2('Mismatch - Related IDs Source: ' + object.Id + ' Target: ' +  targetObject.Id  ); 
            targetObject[AppUtils.replaceaNameSpace('%name-space%GlobalKey__c')] = sourcegk;
            delete targetObject[AppUtils.replaceaNameSpace('%name-space%AttributeId__r.%name-space%GlobalKey__c')];
            recordsToUpdate.push(targetObject);
            //console.log(JSON.stringify(targetObject));
          }
        }
      }
    }
    if(recordsToUpdate.length > 0){
      AppUtils.log2('Updating Target:'); 
      await attributeAssigmentGKFix.updateRows(recordsToUpdate,connTarget,AppUtils.replaceaNameSpace('%name-space%AttributeAssignment__c'));
    }
    if(recordsToUpdateSource.length > 0){
      AppUtils.log2('Updating Source:'); 
      await attributeAssigmentGKFix.updateRows(recordsToUpdateSource,connSource,AppUtils.replaceaNameSpace('%name-space%AttributeAssignment__c'));
    }
  }

  static async updateRows(records,conn,objectName) {
    var job = await conn.bulk.createJob(objectName,'update');
    await job.open();
    //console.log(job);
    var numOfComonents = records.length;
    var div = numOfComonents/this.batchSize;
    var numberOfBatches = Math.floor(div) == div ? div : Math.floor(div)  + 1;
    var numberOfBatchesDone = 0;
    AppUtils.log2('Number Of Batches to be created to Update Rows: ' + numberOfBatches);
    try {
      var promises = [];
      for (var i=0; i<numberOfBatches; i++) {
        
        var arraytoupdate = records;
        if(i<(numberOfBatches-1)) {
          arraytoupdate = records.splice(0,this.batchSize);
        }
        let newp = new Promise((resolve, reject) => {
          var batchNumber = i + 1;
          var batch = job.createBatch()
          AppUtils.log1('Creating Batch # ' + batchNumber + ' Number of Records: ' + arraytoupdate.length);

          //console.log('Enter Promise');
          batch.execute(arraytoupdate)
          .on("error",  function(err) { 
            console.log('Error, batch Info:', err);
            numberOfBatchesDone = numberOfBatchesDone +1;
            //resultData.push({ ObjectName: objectName , RecordsFound: records.length , DeleteSuccess: 'No Error: ' + err});
            resolve();
          })
          .on("queue",  function(batchInfo) { 
            batch.poll(5*1000 /* interval(ms) */, 1000*60*120 /* timeout(ms) */);
            AppUtils.log1('Batch #' + batchNumber +' with Id: ' + batch.id + ' Has started');
          })
          .on("response",  function(rets) { 
            numberOfBatchesDone = numberOfBatchesDone +1;
            var hadErrors = attributeAssigmentGKFix.noErrors(rets);
            //console.log(rets);
            AppUtils.log1('Batch #' + batchNumber + ' With Id: ' + batch.id + ' Finished - Success: ' + hadErrors + '  '+ numberOfBatchesDone + '/' + numberOfBatches + ' Batches have finished');
            //resultData.push({ ObjectName: objectName , RecordsFound: records.length , DeleteSuccess: hadErrors});
            resolve();
          });
          //console.log('batch: '+ batch);
        }).catch(error => {
          AppUtils.log2('Error Creating  batches - Error: ' + error);
          //resultData.push({ ObjectName: objectName , RecordsFound: records.length , DeleteSuccess: 'No Error: ' + error});
        });
        await promises.push(newp);
      }
      //console.log('Promise Size: '+ Promise.length);
      await Promise.all(promises);
      job.close();
    } catch (error) {
      job.close();
      AppUtils.log2('Error Creating  batches - Error: ' + error);
      //resultData.push({ ObjectName: objectName , RecordsFound: records.length , DeleteSuccess: 'No Error: ' + error});
    }
  }

  static createMapforNonAA(records,product2Map){
    let map = new Map();
    for (let index = 0; index < records.length; index++) {
      const element = records[index];
      var objectid = element[AppUtils.replaceaNameSpace('%name-space%ObjectId__c')];
      var product2GK = product2Map.get(objectid);
      if(product2GK) {
        var attributeGK = element[AppUtils.replaceaNameSpace('%name-space%AttributeId__r.%name-space%GlobalKey__c')];
        var key = product2GK + attributeGK;
        //console.log('Key: ' + key);
        var array = [] ;
        if(map.get(key)) {
          array = map.get(key);
        }
        array.push(element);
        map.set(key, array);
      } else {
        AppUtils.log1('Invalid AA - ObjectId does not exist - AA ID: ' + element.Id); 
      }
    }
    return map;
  }

  static async query(conn, initialQuery) {
    var query = AppUtils.replaceaNameSpace(initialQuery);
    AppUtils.startSpinner('Fetching records');
    //console.log('Query:  ' + query); 
    var count = 0;
    var records = [];
    conn.bulk.pollInterval = 5000; // 5 sec
    conn.bulk.pollTimeout = 120000; // 60 sec
    let promise = new Promise((resolve, reject) => {
      conn.bulk.query(query)
        .on('record', function(result) { 
          records.push(result);
          count++;
          AppUtils.updateSpinnerMessage('Objects Fetched so far: ' + count);
        })
        .on("queue", function(batchInfo) {
          AppUtils.log3('Fetch queued');
          AppUtils.updateSpinnerMessage('Fetch queued');
        })
        .on("end", function() {
          if (records.length > 0){
            AppUtils.stopSpinnerMessage('Succesfully Fetched All Row records... Number of records: ' + records.length);
            resolve('Done');
          }
          else {
            AppUtils.stopSpinnerMessage('No Rows where found');
            resolve('No');
          }
        })
        .on('error', function(err) {
          AppUtils.stopSpinnerMessage('Error Fetching: ' + err)
          resolve(err);
        });
    });
    await promise;
    return records;
  }

  private static noErrors(rets){
    for (let index = 0; index < rets.length; index++) {
      const element = rets[index];
      if(!element.success){
        return false;
      }
    }
    return true;
  }
    
}
