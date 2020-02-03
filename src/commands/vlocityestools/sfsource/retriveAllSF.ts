import { flags, SfdxCommand } from '@salesforce/command';
import { Messages } from '@salesforce/core';
import { AppUtils } from '../../../utils/AppUtils';

// Initialize Messages with the current plugin directory
Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = Messages.loadMessages('vlocityestools', 'ExportAll');



var standardValueSets = [
  "standardValueSets/AccountContactMultiRoles.standardValueSet",
  "standardValueSets/AccountContactRole.standardValueSet",
  "standardValueSets/AccountOwnership.standardValueSet",
  "standardValueSets/AccountRating.standardValueSet",
  "standardValueSets/AccountType.standardValueSet",
  "standardValueSets/AssetStatus.standardValueSet",
  "standardValueSets/CampaignMemberStatus.standardValueSet",
  "standardValueSets/CampaignStatus.standardValueSet",
  "standardValueSets/CampaignType.standardValueSet",
  "standardValueSets/CaseContactRole.standardValueSet",
  "standardValueSets/CaseOrigin.standardValueSet",
  "standardValueSets/CasePriority.standardValueSet",
  "standardValueSets/CaseReason.standardValueSet",
  "standardValueSets/CaseStatus.standardValueSet",
  "standardValueSets/CaseType.standardValueSet",
  "standardValueSets/ContactRole.standardValueSet",
  "standardValueSets/ContractContactRole.standardValueSet",
  "standardValueSets/ContractStatus.standardValueSet",
  "standardValueSets/EntitlementType.standardValueSet",
  "standardValueSets/EventSubject.standardValueSet",
  "standardValueSets/EventType.standardValueSet",
  "standardValueSets/FiscalYearPeriodName.standardValueSet",
  "standardValueSets/FiscalYearPeriodPrefix.standardValueSet",
  "standardValueSets/FiscalYearQuarterName.standardValueSet",
  "standardValueSets/FiscalYearQuarterPrefix.standardValueSet",
  "standardValueSets/IdeaCategory1.standardValueSet",
  "standardValueSets/IdeaMultiCategory.standardValueSet",
  "standardValueSets/IdeaStatus.standardValueSet",
  "standardValueSets/IdeaThemeStatus.standardValueSet",
  "standardValueSets/Industry.standardValueSet",
  "standardValueSets/LeadSource.standardValueSet",
  "standardValueSets/LeadStatus.standardValueSet",
  "standardValueSets/OpportunityCompetitor.standardValueSet",
  "standardValueSets/OpportunityStage.standardValueSet",
  "standardValueSets/OpportunityType.standardValueSet",
  "standardValueSets/OrderStatus.standardValueSet",
  "standardValueSets/OrderType.standardValueSet",
  "standardValueSets/PartnerRole.standardValueSet",
  "standardValueSets/Product2Family.standardValueSet",
  "standardValueSets/QuestionOrigin1.standardValueSet",
  "standardValueSets/QuickTextCategory.standardValueSet",
  "standardValueSets/QuickTextChannel.standardValueSet",
  "standardValueSets/QuoteStatus.standardValueSet",
  "standardValueSets/RoleInTerritory2.standardValueSet",
  "standardValueSets/SalesTeamRole.standardValueSet",
  "standardValueSets/Salutation.standardValueSet",
  "standardValueSets/ServiceContractApprovalStatus.standardValueSet",
  "standardValueSets/SocialPostClassification.standardValueSet",
  "standardValueSets/SocialPostEngagementLevel.standardValueSet",
  "standardValueSets/SocialPostReviewedStatus.standardValueSet",
  "standardValueSets/SolutionStatus.standardValueSet",
  "standardValueSets/TaskPriority.standardValueSet",
  "standardValueSets/TaskStatus.standardValueSet",
  "standardValueSets/TaskSubject.standardValueSet",
  "standardValueSets/TaskType.standardValueSet",
  "standardValueSets/WorkOrderLineItemStatus.standardValueSet",
  "standardValueSets/WorkOrderPriority.standardValueSet",
  "standardValueSets/WorkOrderStatus.standardValueSet"
];

export default class retriveAllSF extends SfdxCommand {

  public static description = messages.getMessage('commandDescription');

  public static examples = [
  `$ sfdx vlocityestools:sfsource:retriveAllSF -u myOrg@example.com
  `,
  `$ sfdx vlocityestools:sfsource:retriveAllSF --targetusername myOrg@example.com
  `
  ];

  public static API_VERSION = '47.0';

  public static args = [{name: 'file'}];

  protected static flagsConfig = {
    //package: flags.string({char: 'p', description: messages.getMessage('packageType')}),
    //sourcefolder: flags.string({char: 'd', description: messages.getMessage('sourcefolder')}),
  };

  protected static requiresUsername = true;


  public async run(){

    const conn = this.org.getConnection();
    
    retriveAllSF.doSFExport(conn);
      
  }

  static async doSFExport(conn) {

    let allMetadata = await conn.metadata.describe(retriveAllSF.API_VERSION); 

    var metadata = [];
    var allSFDXFileNames = new Set();

    for (var metaDesc of allMetadata.metadataObjects) {
      retriveAllSF.retrieveIndividualMetadata(conn,metadata,allSFDXFileNames,metaDesc);
    }

  }

  static  retrieveIndividualMetadata(conn,metadata,allSFDXFileNames,metaDesc) {
    var thisMetadata = '';
    var promResult;

    if (metaDesc.xmlName == 'Layout') {
        promResult =  this.getLayoutsFromToolingAPI(metaDesc.xmlName, allSFDXFileNames);
    } else if (metaDesc.xmlName == 'StandardValueSets') {
       promResult = [{ metadata: standardValueSets.join(',') }];
        standardValueSets.forEach(item => allSFDXFileNames.add(item));
    } else {
        promResult = await this.retrieveByType(deploymentOptions, metaDesc, jobInfo);
    }


  }


  static retrieveByType = async function(metaDesc,allSFDXFileNames ) {
    var tries = 0;
    
    while (tries < 10) {
        try {
            var metadata = '';

            let metaList = [];

            if (metaDesc.inFolder) {
                var folderMetadataType = `${metaDesc.xmlName}Folder`;

                if (metaDesc.xmlName == 'EmailTemplate') {
                    folderMetadataType = 'EmailFolder';
                }

                var folderList = await this.vlocity.jsForceConnection.metadata.list([{ type: folderMetadataType, folder: null }], retriveAllSF.API_VERSION);

                if (!Array.isArray(folderList)) {
                    folderList = [ folderList ];
                }

                for (var folderName of folderList) {
                    if (folderName.manageableState == 'unmanaged') {
                        var inFolderFiles = await this.vlocity.jsForceConnection.metadata.list([{ type: metaDesc.xmlName, folder: folderName.fullName }], retriveAllSF.API_VERSION);
                        
                        if (!Array.isArray(inFolderFiles)) {
                            inFolderFiles = [ inFolderFiles ];
                        }

                        for (var folderFile of inFolderFiles) {
                            metaList.push(folderFile);
                        }
                    }
                }
            } else {
                metaList = await this.vlocity.jsForceConnection.metadata.list([{ type: metaDesc.xmlName, folder: null }], retriveAllSF.API_VERSION);
            } 

            var allPromises = [];

            if (metaList) {
                
                if (!Array.isArray(metaList)) {
                    metaList = [ metaList ];
                }
                
                for (var meta of metaList) {
                    
                    if (meta.type == 'CustomObject') {
                        if (!meta.namespacePrefix && this.shouldRetrieveSalesforceType(jobInfo, meta)) {    
                            allSFDXFileNames.add(`objects/${meta.fullName}/${meta.fullName}.object-meta.xml`);
                        }

                        allPromises.push(this.getCustomObjectInfo(deploymentOptionsForNames, meta, jobInfo));
                    } else if (meta.type == 'Profile' ) {
                        allSFDXFileNames.add(meta.fileName);
                        allPromises.push(this.isCustomProfileOrAdmin(meta));
                    } else if (!meta.namespacePrefix || meta.type == 'InstalledPackage') {
                        if (metadata) {
                            metadata += ',';
                        }

                        allSFDXFileNames.add(meta.fileName);

                        metadata += `${meta.type}:${meta.fullName}`;
                    }
                }
            }

            if (allPromises.length > 0) {
                var allCustomObject = await Promise.all(allPromises);

                if (metaDesc.xmlName == 'CustomObject') {
                    metadata = 'CustomObject';

                    for (var obj of allCustomObject) {
                        if (obj) {
                            if (obj.metadata) {
                                metadata += ',' + obj.metadata;
                            }

                            if (obj.allSFDXFileNames) {

                                for (var item of obj.allSFDXFileNames) {
                                    allSFDXFileNames.add(item);
                                }
                            }
                        }
                    }
                }

                return [ metadata ];
            } 
            
            return [ metadata ];
        } catch (e) {
            tries++;
           
            if (tries > 10) {
                AppUtils.log1(e);
            } else {
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }
    }
}


  static getLayoutsFromToolingAPI = async function(objectType, allSFDXFileNames) {

    var metadata = '';

    let metaList = await this.vlocity.jsForceConnection.tooling.query(`Select Name, TableEnumOrId, NamespacePrefix from ${objectType}`);

    let customObjectData = await this.vlocity.jsForceConnection.tooling.query(`Select Id, DeveloperName, NamespacePrefix from CustomObject`);
    var customObjectsById = {};

    var allCustomObjMetadata = await this.vlocity.utilityservice.getAllValidSObjects();

    var customObjectsById = {};

    for (var obj of Object.values(allCustomObjMetadata)) {

        if (obj['id']) {
            customObjectsById[obj['id']] = obj['fullName'];
        }
    }

    for (let obj of customObjectData.records) {

        if (!customObjectsById[obj.Id] && obj.NamespacePrefix) {
            customObjectsById[obj.Id] = `${obj.NamespacePrefix}__${obj.DeveloperName}__c`;
        }
    }

    for (var met of metaList.records) {
        if (metadata) {
            metadata += ',';    
        }

        if (met.NamespacePrefix) {
            allSFDXFileNames.add(`layouts/${customObjectsById[met.TableEnumOrId] ? customObjectsById[met.TableEnumOrId] : met.TableEnumOrId}-${met.NamespacePrefix}__${met.Name.replace('(', '%28').replace(')', '%29')}`);
        
            metadata += `${objectType}:${customObjectsById[met.TableEnumOrId] ? customObjectsById[met.TableEnumOrId] : met.TableEnumOrId}-${met.NamespacePrefix}__${met.Name.replace('(', '%28').replace(')', '%29')}`;
        } else {
            allSFDXFileNames.add(`layouts/${customObjectsById[met.TableEnumOrId] ? customObjectsById[met.TableEnumOrId] : met.TableEnumOrId}-${met.Name.replace('(', '%28').replace(')', '%29')}`);
        
            metadata += `${objectType}:${customObjectsById[met.TableEnumOrId] ? customObjectsById[met.TableEnumOrId] : met.TableEnumOrId}-${met.Name.replace('(', '%28').replace(')', '%29')}`;
        }
        
    }
                        
    return [{ metadata: metadata }];

  }



}
