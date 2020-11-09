import { AppUtils } from './AppUtils';

const fsExtra = require("fs-extra");

export class DBUtils  {

    private static batchSize = 10000;

    static async bulkAPIquery(conn, initialQuery) {
        var query = AppUtils.replaceaNameSpace(initialQuery);
        AppUtils.startSpinner('Fetching records');
        //console.log('Query:  ' + query); 
        var count = 0;
        var records = [];
        conn.bulk.pollInterval = 5000;
        conn.bulk.pollTimeout = 240000; 
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

    static async bulkAPIUpdate(records,conn,objectName) {
        //console.log('Before Creating Job');
        var job = await conn.bulk.createJob(objectName,'update');
        //console.log('Before Opening Job');
        await job.open();
        //console.log('Open Job');
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
                var hadErrors = DBUtils.noErrors(rets);
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

      static async bulkAPIdelete(records,conn,objectName,save,hardelete,resultData,bulkApiPollTimeout) {
        var deleteType = hardelete == true ? 'hardDelete' : 'Delete';
        var job = await conn.bulk.createJob(objectName,deleteType);
        await job.open();
        //console.log(job);
        var numOfComonents = records.length;
        var div = numOfComonents/this.batchSize;
        var numberOfBatches = Math.floor(div) == div ? div : Math.floor(div)  + 1;
        var numberOfBatchesDone = 0;
        AppUtils.log2('Number Of Batches to be created to delete Rows: ' + numberOfBatches);
        try {
          var promises = [];
          for (var i=0; i<numberOfBatches; i++) {
            
            var arraytoDelete = records;
            if(i<(numberOfBatches-1)) {
              arraytoDelete = records.splice(0,this.batchSize);
            }
            let newp = new Promise((resolve, reject) => {
              var batchNumber = i + 1;
              var batch = job.createBatch()
              AppUtils.log1('Creating Batch # ' + batchNumber + ' Number of Records: ' + arraytoDelete.length);
    
              //console.log('Enter Promise');
              batch.execute(arraytoDelete)
              .on("error",  function(err) { 
                console.log('Error, batch Info:', err);
                numberOfBatchesDone = numberOfBatchesDone +1;
                if(resultData){
                  resultData.push({ ObjectName: objectName , RecordsFound: records.length , DeleteSuccess: 'No Error: ' + err});
                }
                resolve();
              })
              .on("queue",  function(batchInfo) { 
                batch.poll(5*1000 /* interval(ms) */, 1000*60*bulkApiPollTimeout /* timeout(ms) */);
                AppUtils.log1('Batch #' + batchNumber +' with Id: ' + batch.id + ' Has started');
              })
              .on("response",  function(rets) { 
                numberOfBatchesDone = numberOfBatchesDone +1;
                var hadErrors = this.noErrors(rets);
                //console.log(rets);
                AppUtils.log1('Batch #' + batchNumber + ' With Id: ' + batch.id + ' Finished - Success: ' + hadErrors + '  '+ numberOfBatchesDone + '/' + numberOfBatches + ' Batches have finished');
                if(resultData){
                  resultData.push({ ObjectName: objectName , RecordsFound: records.length , DeleteSuccess: hadErrors});
                }
                  if(save){
                  DBUtils.saveResults(rets,batchNumber,objectName);
                }
                resolve();
              });
              //console.log('batch: '+ batch);
            }).catch(error => {
              AppUtils.log2('Error Creating  batches - Error: ' + error);
              if(resultData){
                resultData.push({ ObjectName: objectName , RecordsFound: records.length , DeleteSuccess: 'No Error: ' + error});
              }
            });
            await promises.push(newp);
          }
          //console.log('Promise Size: '+ Promise.length);
          await Promise.all(promises);
          job.close();
        } catch (error) {
          job.close();
          AppUtils.log2('Error Creating  batches - Error: ' + error);
          if(resultData){
            resultData.push({ ObjectName: objectName , RecordsFound: records.length , DeleteSuccess: 'No Error: ' + error});
          }
        }
      }

      private static saveResults(rets,batchNumber,objectName) {
        var fileName = 'Results_' + objectName + '_' + batchNumber + '.json';
        if (fsExtra.existsSync(fileName)) {
          fsExtra.unlinkSync(fileName);
        }
        const createFiles = fsExtra.createWriteStream(fileName, {flags: 'a'});
        createFiles.write(JSON.stringify(rets));  
        AppUtils.log1('File Created: ' + fileName); 
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