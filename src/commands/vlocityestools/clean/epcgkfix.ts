import { flags, SfdxCommand } from '@salesforce/command';
import { Messages, SfdxError, Org } from '@salesforce/core';
import { AppUtils } from '../../../utils/AppUtils';
import { DBUtils } from '../../../utils/DBUtils';

// Initialize Messages with the current plugin directory
Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = Messages.loadMessages('vlocityestools', 'epcgkfix');

const fsExtra = require("fs-extra");
const yaml = require('js-yaml');

var OverrideUniqueFieldsForAA = [
  '%name-space%ProductHierarchyGlobalKeyPath__c',
  '%name-space%ProductId__r.%name-space%GlobalKey__c',
  '%name-space%PromotionId__r.%name-space%GlobalKey__c',
  '%name-space%PromotionItemId__r.%name-space%ProductId__r.%name-space%GlobalKey__c',
  '%name-space%PromotionItemId__r.%name-space%ContextProductId__r.%name-space%GlobalKey__c',
  '%name-space%PromotionItemId__r.%name-space%OfferId__r.%name-space%GlobalKey__c',
  '%name-space%OverridingAttributeAssignmentId__r.%name-space%AttributeId__r.%name-space%Code__c',
];

var OverrideUniqueFieldsForPCI = [
  '%name-space%ProductHierarchyGlobalKeyPath__c',
  '%name-space%ProductId__r.%name-space%GlobalKey__c',
  '%name-space%PromotionId__r.%name-space%GlobalKey__c',
  '%name-space%PromotionItemId__r.%name-space%ProductId__r.%name-space%GlobalKey__c',
  '%name-space%PromotionItemId__r.%name-space%ContextProductId__r.%name-space%GlobalKey__c',
  '%name-space%PromotionItemId__r.%name-space%OfferId__r.%name-space%GlobalKey__c'
];

export default class epcGlobalKeySync extends SfdxCommand {

  public static description = messages.getMessage('commandDescription');

  public static keySeparator = '|';

  public static examples = [
  `$ sfdx vlocityestools:clean:epcgkfix -s myOrg@example.com -t myOrg2@example.com  -p cmt --pci  --aa 
  `,
  `$ sfdx vlocityestools:clean:epcgkfix --source myOrg--target myOrg2 --aa
  `
  ];

  public static args = [{name: 'file'}];

  protected static flagsConfig = {
    package: flags.string({char: 'p', description: messages.getMessage('packageType')}),
    source: flags.string({char: 's', description: messages.getMessage('source')}),
    target: flags.string({char: 't', description: messages.getMessage('target')}),
    pci: flags.boolean({char: 'c', description: messages.getMessage('pci')}),
    aa: flags.boolean({char: 'a', description: messages.getMessage('aa')}),
    check: flags.boolean({char: 'v', description: messages.getMessage('check')}),
    definitions: flags.string({char: 'd', description: messages.getMessage('definitions')})
  };

  // Comment this out if your command does not require an org username
  protected static requiresUsername = false;

  // Comment this out if your command does not support a hub org username
  //protected static supportsDevhubUsername = true;

  // Set this to true if your command requires a project workspace; 'requiresProject' is false by default
  //protected static requiresProject = false;

  public async run() {

    AppUtils.ux = this.ux;
    AppUtils.logInitial(messages.getMessage("command"));
    AppUtils.ux.log(' ');

    var packageType = this.flags.package;
    var source = this.flags.source;
    var target = this.flags.target;
    var checkMode = this.flags.check;
    var definitions = this.flags.definitions;

    var pci = this.flags.pci;
    var aa = this.flags.aa;
    //console.log('pci: ' + pci + ' aa: ' + aa);

    const org1: Org = await Org.create({ aliasOrUsername: source });
    const org2: Org = await Org.create({ aliasOrUsername: target });
    
    const connSource = org1.getConnection();
    const connTarget = org2.getConnection();

    var nameSpaceSet = await AppUtils.setNameSpace(connSource,packageType);
    //console.log('nameSpaceSet: ' + nameSpaceSet);
    if(!nameSpaceSet){
      throw new SfdxError("Error: Package was not set or incorrect was provided.");
    }
    
    var doc; 
    
    if (definitions) {
      if (!fsExtra.existsSync(definitions)) {
        throw new Error("Error: File: " + definitions + " does not exist");
      } else {
        doc = yaml.safeLoad(fsExtra.readFileSync(definitions, 'utf8'));
        var pciDef = doc.PCI;
        var aaDef = doc.AA;
        if(pciDef && pciDef.length > 0){
          OverrideUniqueFieldsForPCI = AppUtils.replaceaNameSpaceFromFileArray(pciDef);
          
        }
        if(pciDef && pciDef.length > 0){
          OverrideUniqueFieldsForAA = AppUtils.replaceaNameSpaceFromFileArray(aaDef);
        }
        //console.log(OverrideUniqueFieldsForPCI);
        //console.log(OverrideUniqueFieldsForAA);
      }
    } 
    

    try {
      if(aa){
        AppUtils.log4('Attribute Assignments Global Key Sync'); 
        AppUtils.ux.log(' ');
        AppUtils.log2('Creating Products Maps needed for ObjectId'); 
        AppUtils.log2('Source:'); 
        var sourceProduct2Map = await epcGlobalKeySync.createProduct2Map(connSource);
        AppUtils.log2('Target:'); 
        var targetProduct2Map = await epcGlobalKeySync.createProduct2Map(connTarget);
        AppUtils.ux.log(' ');
        AppUtils.log3('Fixing Non Override AA - records will be matched by AttributeId and ObjectId'); 
        await epcGlobalKeySync.fixNonOverrideAA(connSource,connTarget,sourceProduct2Map,targetProduct2Map,checkMode);
        AppUtils.ux.log(' ');
        AppUtils.log3('Fixing Override AA - records will be matched by Matching OverrideDefintions'); 
        let query = epcGlobalKeySync.createOverrideDefQueryForAA();
        await epcGlobalKeySync.fixOverrideAAorPCI(connSource,connTarget,checkMode,AppUtils.replaceaNameSpace('%name-space%AttributeAssignment__c'),query);
        AppUtils.ux.log(' ');
      }
      if(pci){
        AppUtils.log4('Product Child Items Global Key Sync'); 
        AppUtils.ux.log(' ');
        AppUtils.log3('Fixing Non Override PCI - records will be matched by Matching ParentProductId and ChildProductId'); 
        await epcGlobalKeySync.fixNonOverridePCI(connSource,connTarget,sourceProduct2Map,targetProduct2Map,checkMode);
        AppUtils.ux.log(' ');
        AppUtils.log3('Fixing Override PCI - records will be matched by Matching OverrideDefintions'); 
        let query = epcGlobalKeySync.createOverrideDefQueryForPCI();
        await epcGlobalKeySync.fixOverrideAAorPCI(connSource,connTarget,checkMode,AppUtils.replaceaNameSpace('%name-space%ProductChildItem__c'),query);
        AppUtils.ux.log(' ');
      }
      
    } catch (error) {
      console.log(error.stack);
    }
  }

  static async fixOverrideAAorPCI(connSource,connTarget,checkMode,ObjectAPINname,queryString) {
    AppUtils.log2('Creating ' + ObjectAPINname + ' Maps'); 
    AppUtils.log2('Source: '); 
    var sourceAAMap = await epcGlobalKeySync.createPCIorAAOverrideMap(connSource,ObjectAPINname);
    AppUtils.log2('Target: '); 
    var targetAAMap = await epcGlobalKeySync.createPCIorAAOverrideMap(connTarget,ObjectAPINname);
    AppUtils.ux.log(' ');
    
    AppUtils.log2('Fetching Override Definitions records from Source'); 
    var sourceOO = await DBUtils.bulkAPIquery(connSource,queryString);
    var sourceOOMap = epcGlobalKeySync.createMapforObjectforOverrideDefinitions(sourceOO,OverrideUniqueFieldsForAA);
    AppUtils.log2('Fetching Override Definitions records from Target'); 
    var targetOO = await DBUtils.bulkAPIquery(connTarget,queryString);
    var targetOOMap = epcGlobalKeySync.createMapforObjectforOverrideDefinitions(targetOO,OverrideUniqueFieldsForAA);
    AppUtils.ux.log(' ');
    var objectName = ObjectAPINname.split("__")[1];
    var recordsToUpdate = [];
    var recordsToUpdateSource = [];
    AppUtils.log2('Matching ' + ObjectAPINname + ' by using OverrideDefintions'); 
    for (let [key, objectArray] of sourceOOMap) {
      var object = objectArray[0];
      if(objectArray.length > 1) {
        AppUtils.log2('Source duplicated Found - Records Will be Updated with Same GlobalKey if necessary - Related IDs:');
        AppUtils.log1(object.Id); 
        var sourceOverridingRecordID = object[AppUtils.replaceaNameSpace('%name-space%Overriding' + objectName + 'Id__c')]; 
        var sourceOverridingRecord = sourceAAMap.get(sourceOverridingRecordID);
        var sourceOverridingRercordGK = sourceOverridingRecord[AppUtils.replaceaNameSpace('%name-space%GlobalKey__c')];
        for (let index = 1; index < objectArray.length; index++) {
          var duplicateObjectToUpdate = objectArray[index];
          AppUtils.log1(duplicateObjectToUpdate.Id); 
          var targetOverridingRecordID = duplicateObjectToUpdate[AppUtils.replaceaNameSpace('%name-space%Overriding' + objectName + 'Id__c')];
          var targetOverridingRecord = sourceAAMap.get(targetOverridingRecordID);   
          if(targetOverridingRecord){  
            var targetOverridingRecordGK = targetOverridingRecord[AppUtils.replaceaNameSpace('%name-space%GlobalKey__c')];
            if(sourceOverridingRercordGK != targetOverridingRecordGK) {
              //console.log(sourceOverridingRercordGK + '|' + targetOverridingRecordGK)
              //console.log(sourceOverridingRecord);
              //console.log(targetOverridingRecord);
              targetOverridingRecord[AppUtils.replaceaNameSpace('%name-space%GlobalKey__c')] = sourceOverridingRercordGK;
              //console.log(targetOverridingRecord);
              recordsToUpdateSource.push(targetOverridingRecord);
            }
          }
        }
      } 
      //console.log('Key: ' + key);
      var targetObjects = targetOOMap.get(key);
      //console.log('targetObject: ' + targetObjects);
      if(targetObjects) {
        if(targetObjects.length > 1){
          AppUtils.log2('Target duplicated Found - Records Will be Updated with Same GlobalKey if necessary - Related IDs:' );
          for (let index = 0; index < targetObjects.length; index++) {
            const targetObject = targetObjects[index];
            AppUtils.log1(targetObject.Id);
          }
        }
        for (let index = 0; index < targetObjects.length; index++) {
          const targetObject = targetObjects[index];
          var sourceOverridingRecordID = object[AppUtils.replaceaNameSpace('%name-space%Overriding' + objectName + 'Id__c')]; 
          var targetOverridingRecordID = targetObject[AppUtils.replaceaNameSpace('%name-space%Overriding' + objectName + 'Id__c')];
          var sourceOverridingRecord = sourceAAMap.get(sourceOverridingRecordID); 
          var targetOverridingRecord = targetAAMap.get(targetOverridingRecordID);   
          if(sourceOverridingRecord && targetOverridingRecord){
            var sourceOverridingRecordGK = sourceOverridingRecord[AppUtils.replaceaNameSpace('%name-space%GlobalKey__c')];
            var targetOverridingRecordGK = targetOverridingRecord[AppUtils.replaceaNameSpace('%name-space%GlobalKey__c')];
            //console.log('sourceOverridingRecordGK: ' + sourceOverridingRecordGK + '  targetOverridingRecordGK: ' + targetOverridingRecordGK);
            if(sourceOverridingRecordGK != targetOverridingRecordGK) {
              AppUtils.log2('Mismatch - Related IDs Source: ' + sourceOverridingRecord.Id + ' Target: ' +  targetOverridingRecord.Id  ); 
              targetOverridingRecord[AppUtils.replaceaNameSpace('%name-space%GlobalKey__c')] = sourceOverridingRecordGK;
              //delete targetObject[AppUtils.replaceaNameSpace('%name-space%OverridingAttributeAssignmentId__r.%name-space%AttributeId__r.%name-space%Code__c')];
              recordsToUpdate.push(targetOverridingRecord);
              //console.log(JSON.stringify(targetOverridingAttributeAssignment));
            }
          }
        }  
      }
    }
    if(recordsToUpdate.length > 0 && !checkMode){
      AppUtils.log2('Updating Target:'); 
      await DBUtils.bulkAPIUpdate(recordsToUpdate,connTarget,ObjectAPINname);
    }
    if(recordsToUpdateSource.length > 0 && !checkMode){
      AppUtils.log2('Updating Source:'); 
      await DBUtils.bulkAPIUpdate(recordsToUpdateSource,connSource,ObjectAPINname);
    }
    else {
      AppUtils.log2('No Records to update'); 
    }
  }

  static async fixNonOverridePCI(connSource,connTarget,sourceProduct2Map,targetProduct2Map,checkMode) {
    var queryString= "SELECT id, %name-space%GlobalKey__c, %name-space%ParentProductId__r.%name-space%GlobalKey__c, %name-space%ChildProductId__r.%name-space%GlobalKey__c FROM %name-space%ProductChildItem__c WHERE %name-space%IsOverride__c = false";
    AppUtils.log2('Fetching PCI records from Source'); 
    var sourceAA = await DBUtils.bulkAPIquery(connSource,queryString);
    var sourceAAMap = epcGlobalKeySync.createMapforNonPCI(sourceAA);
    AppUtils.log2('Fetching PCI records from Target'); 
    var targetAA = await DBUtils.bulkAPIquery(connTarget,queryString);
    var targetAAMap = epcGlobalKeySync.createMapforNonPCI(targetAA);
    AppUtils.ux.log(' ');

    AppUtils.log2('Matching by ParentProductGK and ChildProductGK...'); 
    var recordsToUpdateSource = [];
    var recordsToUpdate = [];
    for (let [key, objectArray] of sourceAAMap) {
      var object = objectArray[0];
      if(objectArray.length > 1) {
        var sourcegk = object[AppUtils.replaceaNameSpace('%name-space%GlobalKey__c')];
        for (let index = 1; index < objectArray.length; index++) {
          var duplicateObjectToUpdate = objectArray[index];
          var targetgk = duplicateObjectToUpdate[AppUtils.replaceaNameSpace('%name-space%GlobalKey__c')];
          AppUtils.log2('Source duplicated Found - Records Will be Updated with Same GlobalKey if necessary' ); 
          if(sourcegk != targetgk) {
            duplicateObjectToUpdate[AppUtils.replaceaNameSpace('%name-space%GlobalKey__c')] = sourcegk;
            delete duplicateObjectToUpdate[AppUtils.replaceaNameSpace('%name-space%ParentProductId__r.%name-space%GlobalKey__c')];
            delete duplicateObjectToUpdate[AppUtils.replaceaNameSpace('%name-space%ChildProductId__r.%name-space%GlobalKey__c')];
            recordsToUpdateSource.push(duplicateObjectToUpdate); 
          }
        }
      } 
      //console.log(key + " = " + object);
      var targetObjects = targetAAMap.get(key);
      //console.log('targetObject: ' + targetObject);
      if(targetObjects) {
        if(targetObjects.length > 1){
          AppUtils.log2('Target duplicated Found - Records Will be Updated with Same GlobalKey if necessary - Related IDs:' );
          for (let index = 0; index < targetObjects.length; index++) {
            const targetObject = targetObjects[index];
            AppUtils.log1(targetObject.Id);
          }
        }
        for (let index = 0; index < targetObjects.length; index++) {
          const targetObject = targetObjects[index];
          var sourcegk = object[AppUtils.replaceaNameSpace('%name-space%GlobalKey__c')];
          var targetgk = targetObject[AppUtils.replaceaNameSpace('%name-space%GlobalKey__c')];
          //console.log(sourcegk + " =? " + targetgk);
          if(sourcegk != targetgk) {
            AppUtils.log2('Mismatch - Related IDs Source: ' + object.Id + ' Target: ' +  targetObject.Id  ); 
            targetObject[AppUtils.replaceaNameSpace('%name-space%GlobalKey__c')] = sourcegk;
            delete targetObject[AppUtils.replaceaNameSpace('%name-space%ParentProductId__r.%name-space%GlobalKey__c')];
            delete targetObject[AppUtils.replaceaNameSpace('%name-space%ChildProductId__r.%name-space%GlobalKey__c')];
            recordsToUpdate.push(targetObject);
            //console.log(JSON.stringify(targetObject));
          }
        }
      }
    }
    if(checkMode || (recordsToUpdate.length == 0 && recordsToUpdateSource.length == 0)) {
      AppUtils.log2('No Records to Update');
    }
    if(recordsToUpdate.length > 0 && !checkMode){
      AppUtils.log2('Updating Target:'); 
      //console.log(recordsToUpdate);
      await DBUtils.bulkAPIUpdate(recordsToUpdate,connTarget,AppUtils.replaceaNameSpace('%name-space%ProductChildItem__c'));
    }
    if(recordsToUpdateSource.length > 0 && !checkMode){
      AppUtils.log2('Updating Source:');
      //console.log(recordsToUpdateSource); 
      await DBUtils.bulkAPIUpdate(recordsToUpdateSource,connSource,AppUtils.replaceaNameSpace('%name-space%ProductChildItem__c'));
    }

  }

  static async fixNonOverrideAA(connSource,connTarget,sourceProduct2Map,targetProduct2Map,checkMode) {
    var queryString= "SELECT ID, %name-space%AttributeId__r.%name-space%GlobalKey__c, %name-space%ObjectId__c, %name-space%GlobalKey__c FROM %name-space%AttributeAssignment__c WHERE %name-space%ObjectType__c= 'Product2' AND %name-space%IsOverride__c = false";
    AppUtils.log2('Fetching AA records from Source'); 
    var sourceAA = await DBUtils.bulkAPIquery(connSource,queryString);
    var sourceAAMap = epcGlobalKeySync.createMapforNonAA(sourceAA,sourceProduct2Map);
    AppUtils.log2('Fetching AA records from Target'); 
    var targetAA = await DBUtils.bulkAPIquery(connTarget,queryString);
    var targetAAMap = epcGlobalKeySync.createMapforNonAA(targetAA,targetProduct2Map);
    AppUtils.ux.log(' ');

    AppUtils.log2('Matching by AttributeGK and ObjectGK...'); 
    var recordsToUpdateSource = [];
    var recordsToUpdate = [];
    for (let [key, objectArray] of sourceAAMap) {
      var object = objectArray[0];
      if(objectArray.length > 1) {
        var sourcegk = object[AppUtils.replaceaNameSpace('%name-space%GlobalKey__c')];
        AppUtils.log2('Source Duplicates - Related IDs: '); 
        AppUtils.log1(object.Id); 
        for (let index = 1; index < objectArray.length; index++) {
          var duplicateObjectToUpdate = objectArray[index];
          var targetgk = duplicateObjectToUpdate[AppUtils.replaceaNameSpace('%name-space%GlobalKey__c')];
          AppUtils.log1(duplicateObjectToUpdate.Id); 
          if(sourcegk != targetgk) {
            duplicateObjectToUpdate[AppUtils.replaceaNameSpace('%name-space%GlobalKey__c')] = sourcegk;
            delete duplicateObjectToUpdate[AppUtils.replaceaNameSpace('%name-space%AttributeId__r.%name-space%GlobalKey__c')];
            recordsToUpdateSource.push(duplicateObjectToUpdate); 
          }
        }
      } 
      //console.log('Key: ' + key);
      var targetObjects = targetAAMap.get(key);
      //console.log('targetObject: ' + targetObject);
      if(targetObjects) {
        if(targetObjects.length > 1){
          AppUtils.log2('Target duplicated Found - Records Will be Updated with Same GlobalKey if necessary - Related IDs:' );
          for (let index = 0; index < targetObjects.length; index++) {
            const targetObject = targetObjects[index];
            AppUtils.log1(targetObject.Id);
          }
        }
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

    if(checkMode || (recordsToUpdate.length == 0 && recordsToUpdateSource.length == 0)) {
      AppUtils.log2('No Records to Update');
    }
    if(recordsToUpdate.length > 0 && !checkMode){
      AppUtils.log2('Updating Target:'); 
      //console.log(recordsToUpdate);
      await DBUtils.bulkAPIUpdate(recordsToUpdate,connTarget,AppUtils.replaceaNameSpace('%name-space%AttributeAssignment__c'));
    }
    if(recordsToUpdateSource.length > 0 && !checkMode){
      AppUtils.log2('Updating Source:');
      //console.log(recordsToUpdateSource); 
      await DBUtils.bulkAPIUpdate(recordsToUpdateSource,connSource,AppUtils.replaceaNameSpace('%name-space%AttributeAssignment__c'));
    }


  }

  static createOverrideDefQueryForPCI(){
    //SELECT
    var queryString = "SELECT ID, "
    for (let index = 0; index < OverrideUniqueFieldsForPCI.length; index++) {
      const element = OverrideUniqueFieldsForPCI[index];
      queryString += element + ', '
    }    
    queryString += "%name-space%OverriddenProductChildItemId__c, %name-space%OverridingProductChildItemId__c  ";
    //FROM
    queryString += "FROM %name-space%OverrideDefinition__c "
    //WHERE
    queryString += "WHERE %name-space%OverrideType__c = 'Product Definition' AND %name-space%OverridingProductChildItemId__c != null AND %name-space%OverriddenProductChildItemId__c != null ";  
    return queryString;
  }

  static createOverrideDefQueryForAA(){
    //SELECT
    var queryString = "SELECT ID, "
    for (let index = 0; index < OverrideUniqueFieldsForAA.length; index++) {
      const element = OverrideUniqueFieldsForAA[index];
      queryString += element + ', '
    }
    queryString += "%name-space%OverridingAttributeAssignmentId__c, %name-space%OverriddenAttributeAssignmentId__c"
    // FROM
    queryString += " FROM %name-space%OverrideDefinition__c "
    // WHERE
    queryString += " WHERE %name-space%OverrideType__c = 'Attribute' AND %name-space%OverridingAttributeAssignmentId__c != null AND %name-space%OverriddenAttributeAssignmentId__c != null "
    return queryString;
  }

  static createMapforNonPCI(records){
    let map = new Map();
    for (let index = 0; index < records.length; index++) {
      const element = records[index];
      var parentProductGK = element[AppUtils.replaceaNameSpace('%name-space%ParentProductId__r.%name-space%GlobalKey__c')];
      var childProductGK = element[AppUtils.replaceaNameSpace('%name-space%ChildProductId__r.%name-space%GlobalKey__c')];  
      var key = parentProductGK + childProductGK;
      //console.log('Key: ' + key);
      var array = [] ;
      if(map.get(key)) {
        array = map.get(key);
      }
      array.push(element);
      map.set(key, array);
    }
    return map;
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

  static async createProduct2Map(conn) {
    var queryString= 'SELECT Id, %name-space%GlobalKey__c FROM Product2';
    var products = await DBUtils.bulkAPIquery(conn,queryString);
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

  static async createPCIorAAOverrideMap(conn,object) {
    var queryString= "SELECT ID, %name-space%GlobalKey__c FROM " + object + " WHERE %name-space%IsOverride__c = true";
    var objects = await DBUtils.bulkAPIquery(conn,queryString);
    let map = new Map();
    for (let index = 0; index < objects.length; index++) {
      const element = objects[index];
      var obid = element.Id;
      //console.log('Id: ' + productid + ' gk: ' + gk);
      map.set(obid, element);
    }
    return map;
  }

  static createMapforObjectforOverrideDefinitions(records,fields){
    let map = new Map();
    for (let index = 0; index < records.length; index++) {
      const element = records[index];
      var key = '';
      for (let index2 = 0; index2 < fields.length; index2++) {
        const field = fields[index2];
        key += element[AppUtils.replaceaNameSpace(field)] + this.keySeparator;
      } 
      var array = map.get(key)? map.get(key) : [];
      //console.log(array);
      array.push(element);
      map.set(key, array);
    }
    return map;
  }
  
 
    
}
