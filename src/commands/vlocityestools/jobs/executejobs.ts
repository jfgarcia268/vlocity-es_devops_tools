import { flags, SfdxCommand } from '@salesforce/command';
import { Messages, SfdxError } from '@salesforce/core';
import { AppUtils } from '../../../utils/AppUtils';
import { DBUtils } from '../../../utils/DBUtils';

// Initialize Messages with the current plugin directory
Messages.importMessagesDirectory(__dirname);

const fsExtra = require("fs-extra");
const yaml = require('js-yaml');

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = Messages.loadMessages('vlocityestools', 'executejobs');

export default class executejobs extends SfdxCommand {

  public static description = messages.getMessage('commandDescription');

  public static examples = [
  `$ sfdx vlocityestools:jobs:executejobs -u myOrg@example.com -j jobs.yaml -p 20
  `,
  `$ sfdx vlocityestools:jobs:executejobs --targetusername myOrg@example.com  --jobs jobs.yaml --pooltime 20
  `
  ];

  public static args = [{name: 'file'}];

  protected static flagsConfig = {
    jobs: flags.string({char: 'j', description: messages.getMessage('jobs'), required: true}),
    pooltime: flags.integer({char: 'p', description: messages.getMessage('pooltime')}),
    stoponerror: flags.boolean({char: 's', description: messages.getMessage('stopOnError')}),
    more: flags.boolean({char: 'm', description: messages.getMessage('more')}),
    remoteapex: flags.boolean({char: 'r', description: messages.getMessage('remoteapex')})
  }

  // Comment this out if your command does not require an org username
  protected static requiresUsername = true;

  // Comment this out if your command does not support a hub org username
  //protected static supportsDevhubUsername = true;

  // Set this to true if your command requires a project workspace; 'requiresProject' is false by default
  //protected static requiresProject = false;

  public async run() {

    var jobs = this.flags.jobs;
    var pooltime = this.flags.pooltime;
    var stopOnError = this.flags.stoponerror;
    var more = this.flags.more;
    var remoteapex = this.flags.remoteapex;
    const conn = this.org.getConnection();
    var poolTimeSec = pooltime? pooltime : 10;

    AppUtils.ux = this.ux;
    AppUtils.logInitial(messages.getMessage('command')); 

    if (!fsExtra.existsSync(jobs)) {
      throw new Error("Error: File: " + jobs + " does not exist");
    }

    var userIdQuery = "SELECT Id FROM User WHERE  UserName ='" + this.org.getUsername() + "'";
    const resultId = await conn.query(userIdQuery);
    var runningUserId = resultId.records[0]['Id'];

    var totalStartTime,totalEndTime, ttimeDiff;
    totalStartTime= new Date();
    var doc = yaml.safeLoad(fsExtra.readFileSync(jobs, 'utf8'));
    var jobsList = doc.jobs;
    var resultDataJobsTime = [];
    var tableColumnDataJobsTime = ['Job', 'Time','Success']; 
    var jobFail = false;
    for (const job in jobsList) {
      jobFail = false;
      var startTime,endTime, timeDiff;
      startTime= new Date();
      AppUtils.log4("Running Job: " + jobsList[job]);
      if(jobsList[job].includes('jobdeletequery:')){
        var query = jobsList[job].split(':')[1];
        var object = jobsList[job].split(':')[2];
        AppUtils.log3("Delete Job - Query: " + query);
        await DBUtils.bulkAPIQueryAndDeleteWithQuery(conn,object,query,false,4);
        AppUtils.log2('Job Done');
      } else if  (jobsList[job].includes('jobdelete:')){
        var objectName = jobsList[job].split(':')[1];
        AppUtils.log3("Delete Job - Object: " + objectName);
        await DBUtils.bulkAPIQueryAndDelete(conn,objectName,false,4);
        AppUtils.log2('Job Done' );
      } else {
        var body = { job: jobsList[job] };
        await AppUtils.sleep(2);
        var jobStartTime = (new Date()).toISOString();
        
        if(!remoteapex){
          await executejobs.callJobLocal(conn,body.job); 
        } else {
          await executejobs.callJob(conn,body); 
        }
        var isDone = false;
        var jobsFound = true;
        AppUtils.startSpinner("Checking Status every " + poolTimeSec + " seconds");
        //console.log(jobStartTime);
        var resultData = [];
        var tableColumnData = ['Id', 'Status', 'TotalJobItems', 'JobItemsProcessed','NumberOfErrors','ExtendedStatus','ApexClass']; 
        while(!isDone){
          endTime = new Date();
          timeDiff = endTime - startTime;
          timeDiff /= 1000;
          var tsecondsp = Math.round(timeDiff);
          var timeMessage = tsecondsp > 60 ? (tsecondsp/60).toFixed(2) + ' Minutes' : tsecondsp.toFixed(0) + ' Seconds';
          AppUtils.updateSpinnerMessage("Time Elapsed: " + timeMessage);
          await AppUtils.sleep(poolTimeSec);
          var resultJobs = remoteapex? await executejobs.checkStatus(conn,jobStartTime): await executejobs.checkStatusLocal(conn,jobStartTime,runningUserId);
          //console.log(resultJobs);
          resultData = [];
          if(resultJobs.length > 0){
            isDone = true;
            for (let i = 0; i < resultJobs.length; i++) {
              const jobObject = resultJobs[i];
              var status = jobObject.Status;
              var numberOfErrors = jobObject.NumberOfErrors;
              if(numberOfErrors > 0 || status == 'Failed' || status == 'Aborted') {
                jobFail = true;
              }
              if(status != 'Completed' && status != 'Failed' && status != 'Aborted'){
                //'Completed','Failed','Aborted'
                isDone = false;
                
              } 
              var id = jobObject.Id;
              var totalJobItems = jobObject.TotalJobItems;
              var JobItemsProcessed = jobObject.JobItemsProcessed;
              var extendedStatus = jobObject.ExtendedStatus;
              var apexClass = jobObject.ApexClass.Name;
              resultData.push({ Id: id, Status: status, TotalJobItems: totalJobItems, JobItemsProcessed: JobItemsProcessed, NumberOfErrors: numberOfErrors, ExtendedStatus: extendedStatus, ApexClass: apexClass });
            }
            if(more){
              AppUtils.ux.log('Partial Apex Jobs Results:');
              AppUtils.ux.table(resultData, tableColumnData);
              console.log('');
            }
          } else {
            AppUtils.stopSpinnerMessage("No Jobs where triggered");
            isDone = true;
            jobsFound = false;
            break; 
          }
        }
        AppUtils.stopSpinnerMessage('Job Done');
        if(jobsFound){
          AppUtils.ux.log('Apex Jobs Results:');
          AppUtils.ux.table(resultData, tableColumnData);
          console.log('');
        }  

      }
      endTime = new Date();
      timeDiff = endTime - startTime;
      timeDiff /= 1000;
      var tsecondsp = Math.round(timeDiff);
      var timeMessage = tsecondsp > 60 ? (tsecondsp/60).toFixed(2) + ' Minutes' : tsecondsp.toFixed(0) + ' Seconds';
      resultDataJobsTime.push({ Job: jobsList[job], Time: timeMessage, Success: !jobFail});
      AppUtils.log3("Job Done: " + jobsList[job]);
      AppUtils.log3("Done in " + timeMessage);
      console.log('');
      if(jobFail && stopOnError){
        break;
      }
    }


    totalEndTime = new Date();
    ttimeDiff = totalEndTime - totalStartTime;
    ttimeDiff /= 1000;
    var tminutes = Math.round(ttimeDiff)/60;
    AppUtils.log4("Done Running Jobs in " + tminutes.toFixed(2) + ' Minutes');
    AppUtils.log3("Summary: ");
    AppUtils.ux.table(resultDataJobsTime, tableColumnDataJobsTime);
    console.log('');

    if(jobFail && stopOnError){
      throw new SfdxError("Execution was ended becuase of last job failure ");
    }
  }

  static async callJobLocal(conn,job){
    var apexBody = "";
    //console.log(job);
    if(job == 'EPCFixCompiledAttributeOverrideBatchJob'){
      apexBody = "Database.executeBatch(new vlocity_cmt.EPCFixCompiledAttributeOverrideBatchJob (), 1);";
    } else if(job == 'FixProductAttribJSONBatchJob'){ 
      apexBody = "Database.executeBatch(new vlocity_cmt.FixProductAttribJSONBatchJob(), 1); "; // OLD METHOD
    } else if(job == 'EPCProductAttribJSONBatchJob'){    
      apexBody += "List<Id> productIds = new List<Id>();"
      apexBody += "for (Product2 prod : [ Select Id from Product2 where vlocity_cmt__ObjectTypeId__c != null ]){"
      apexBody +=     "productIds.add(prod.Id);"
      apexBody += "}"
      apexBody += "Database.executeBatch(new vlocity_cmt.EPCProductAttribJSONBatchJob(productIds), 1);"
    } else {
      apexBody += "vlocity_cmt.TelcoAdminConsoleController telcoAdminConsoleController = new vlocity_cmt.TelcoAdminConsoleController();"
      apexBody += "telcoAdminConsoleController.setParameters('" + job + "');"
      apexBody += "telcoAdminConsoleController.invokeMethod();"
    }
    await AppUtils.runApex(conn,apexBody);
  }


  static async callJob(conn,body){
    await conn.apex.post("/CMTJobsUtil/", body, function(err, res) {
      if (err) { 
        return console.error(err); 
      }
      //console.log("response: ", res);
    });
  }

  static  async checkStatus(conn,jobStartTime){
    var jobs = await conn.apex.get("/CMTJobsUtil?jobStartTime="+jobStartTime, {}, function(err, res) {
      if (err) { 
        return console.error(err); 
      }
    });
    return jobs;
  }

  static  async checkStatusLocal(conn,jobStartTime,runningUserId){
    var query = "SELECT Status,CreatedDate,TotalJobItems,JobItemsProcessed,ApexClass.Name,NumberOfErrors,ExtendedStatus "
    query +=    "FROM AsyncApexJob "
    query +=    "WHERE CreatedById='" + runningUserId + "' "
    query +=       "AND JobType='BatchApex' "
    query +=       "AND CreatedDate>=" + jobStartTime
    const result = await conn.query(query);
    //console.log(query);
    //console.log(result.records);
    return result.records; 
  }
  
}
