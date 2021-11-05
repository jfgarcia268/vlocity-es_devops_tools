import { flags, SfdxCommand } from '@salesforce/command';
import { Messages } from '@salesforce/core';
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
    jobs: flags.string({char: 'j', description: messages.getMessage('jobs')}),
    pooltime: flags.integer({char: 'p', description: messages.getMessage('pooltime')}),
    stoponerror: flags.boolean({char: 's', description: messages.getMessage('stopOnError')})
  };

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

    const conn = this.org.getConnection();

    var poolTimeSec = pooltime? pooltime : 10;

    AppUtils.ux = this.ux;
    AppUtils.logInitial(messages.getMessage('command')); 

    if (!fsExtra.existsSync(jobs)) {
      throw new Error("Error: File: " + jobs + " does not exist");
    }

    var totalStartTime,totalEndTime, ttimeDiff  
    totalStartTime= new Date();
    var doc = yaml.safeLoad(fsExtra.readFileSync(jobs, 'utf8'));
    var jobsList = doc.jobs;
    var jobFail = false;
    for (const job in jobsList) {
      AppUtils.log4("Running Job: " + jobsList[job]);
      if(jobsList[job].includes('jobdeletequery:')){
        var query = jobsList[job].split(':')[1];
        var object = jobsList[job].split(':')[2];
        AppUtils.log3("Delete Job - Query: " + query);
        await DBUtils.bulkAPIQueryAndDeleteWithQuery(conn,object,query,false,2);
      } else if  (jobsList[job].includes('jobdelete:')){
        var objectName = jobsList[job].split(':')[1];
        AppUtils.log3("Delete Job - Object: " + objectName);
        await DBUtils.bulkAPIQueryAndDelete(conn,objectName,false,2);
        
      } else {
        var body = { job: jobsList[job] };
        await AppUtils.sleep(2);
        var jobStartTime = (new Date()).toISOString();
        await executejobs.callJob(conn,body); 
        var isDone = false;
        var jobsFound = true;
        AppUtils.startSpinner("Job: " + jobsList[job]);
        //console.log(jobStartTime);
        var resultData = [];
        while(!isDone){
          await AppUtils.sleep(poolTimeSec);
          var resultJobs = await executejobs.checkStatus(conn,jobStartTime);
          resultData = [];
          if(resultJobs.length > 0){
            isDone = true;
            for (let i = 0; i < resultJobs.length; i++) {
              const jobObject = resultJobs[i];
              var status = jobObject.Status;
              var numberOfErrors = jobObject.NumberOfErrors;
              if(numberOfErrors > 0 && status == 'Failed') {
                jobFail = false;
              }
              if(status != 'Completed' && status != 'Failed' && status != 'Aborted'){
                //'Completed','Failed','Aborted'
                isDone = false;
                
              } else {
                var id = jobObject.Id;
                var totalJobItems = jobObject.TotalJobItems;
                var JobItemsProcessed = jobObject.JobItemsProcessed;
                var extendedStatus = jobObject.ExtendedStatus;
                var apexClass = jobObject.ApexClass.Name;
                resultData.push({ ID: id, Status: status, TotalJobItems: totalJobItems, JobItemsProcessed: JobItemsProcessed, NumberOfErrors: numberOfErrors, ExtendedStatus: extendedStatus, ApexClass: apexClass });
              }
            }
          } else {
            AppUtils.stopSpinnerMessage("No Jobs where triggers");
            isDone = true;
            jobsFound = false;
            break; 
          }
        }
        AppUtils.stopSpinnerMessage('Job Done');
        if(jobsFound){
          var tableColumnData = ['ID', 'Status', 'TotalJobItems', 'JobItemsProcessed','NumberOfErrors','ExtendedStatus','ApexClass']; 
          AppUtils.ux.log('Apex Jobs Results:');
          AppUtils.ux.table(resultData, tableColumnData);
        }  

      }
      AppUtils.log3("Done: " + jobsList[job]);
      if(jobFail && stopOnError){
        AppUtils.log3("Execution was ended becuase of last job failure");
        break;
      }
    }

    totalEndTime = new Date();
    ttimeDiff = totalEndTime - totalStartTime;
    ttimeDiff /= 1000;
    var tseconds = Math.round(ttimeDiff)/60;

    AppUtils.log4("Done Running Jobs in " + tseconds.toFixed(2) + ' Minutes');

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
  
}
