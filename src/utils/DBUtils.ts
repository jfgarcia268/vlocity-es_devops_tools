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
            try {
              records.push(result);
              count++;
              AppUtils.updateSpinnerMessage('Objects Fetched so far: ' + count);
            } catch (error) {
              AppUtils.log3('Objects Fetched so far: ' + count);
              AppUtils.stopSpinnerMessage('Error Fetching Record: ' + error)
              resolve(error);
            }
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
        try {
          await promise;
        } catch (error) {
          AppUtils.log3('Error with Promise: ' + error);
        }
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
        AppUtils.log2('Number Of Batches to be created to Upsert Rows: ' + numberOfBatches);
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
                resolve("error");
              })
              .on("queue",  function(batchInfo) { 
                batch.poll(5*1000 /* interval(ms) */, 1000*60*120 /* timeout(ms) */);
                AppUtils.log1('Batch #' + batchNumber +' with Id: ' + batch.id + ' Has started');
              })
              .on("response",  function(rets) { 
                numberOfBatchesDone = numberOfBatchesDone +1;
                var hadErrors = DBUtils.noErrors(rets);
                //console.log(rets);
                AppUtils.log1('Batch #' + batchNumber + ' With Id: ' + batch.id + ' Finished - Success: ' + !hadErrors + '  '+ numberOfBatchesDone + '/' + numberOfBatches + ' Batches have finished');
                //resultData.push({ ObjectName: objectName , RecordsFound: records.length , DeleteSuccess: hadErrors});
                resolve("response");
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

      static async bulkAPIInsert(records,conn,objectName) {
        //console.log('Before Creating Job');
        var job = await conn.bulk.createJob(objectName,'insert');
        //console.log('Before Opening Job');
        await job.open();
        //console.log('Open Job');
        var numOfComonents = records.length;
        var div = numOfComonents/this.batchSize;
        var numberOfBatches = Math.floor(div) == div ? div : Math.floor(div)  + 1;
        var numberOfBatchesDone = 0;
        AppUtils.log2('Number Of Batches to be created to Insert Rows: ' + numberOfBatches);
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
                resolve("error");
              })
              .on("queue",  function(batchInfo) { 
                batch.poll(5*1000 /* interval(ms) */, 1000*60*120 /* timeout(ms) */);
                AppUtils.log1('Batch #' + batchNumber +' with Id: ' + batch.id + ' Has started');
              })
              .on("response",  function(rets) { 
                numberOfBatchesDone = numberOfBatchesDone +1;
                var hadErrors = DBUtils.noErrors(rets);
                //console.log(rets);
                AppUtils.log1('Batch #' + batchNumber + ' With Id: ' + batch.id + ' Finished - Success: ' + !hadErrors + '  '+ numberOfBatchesDone + '/' + numberOfBatches + ' Batches have finished');
                //resultData.push({ ObjectName: objectName , RecordsFound: records.length , DeleteSuccess: hadErrors});
                resolve("response");
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

      static async bulkAPIUpsert(records,conn,objectName,id,save) {
        //console.log('Before Creating Job');
        var job = await conn.bulk.createJob(objectName,'upsert',{extIdField: id,});
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
                resolve("error");
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
                if(save){
                  DBUtils.saveResults(rets,batchNumber,objectName);
                }
                resolve("response");
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

      static async csvToJson(csv) {
        var lines=csv.split("\n");
        var result = [];
      
        var headers=lines[0].split(",");
        for(var i=1;i<lines.length;i++){
      
            var obj = {};
            var currentline=lines[i].split(",");
      
            for(var j=0;j<headers.length;j++){
                obj[headers[j].replace('\r','')] = currentline[j].replace('\r','');
            }
            //console.log(obj);
            result.push(obj);
      
        }
        return result;
      }

      static async bulkAPIQueryAndDelete(conn,objectName,hardelete,bulkApiPollTimeout) {
        var query = 'SELECT ID FROM ' + objectName;
        var records = await DBUtils.bulkAPIquery(conn, query);
        if(records.length > 0){
          await DBUtils.bulkAPIdelete(records,conn,objectName,false,hardelete,null,bulkApiPollTimeout);
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
                resolve("error");
              })
              .on("queue",  function(batchInfo) { 
                batch.poll(5*1000 /* interval(ms) */, 1000*60*bulkApiPollTimeout /* timeout(ms) */);
                AppUtils.log1('Batch #' + batchNumber +' with Id: ' + batch.id + ' Has started');
              })
              .on("response",  function(rets) { 
                numberOfBatchesDone = numberOfBatchesDone +1;
                //var hadErrors = DBUtils.noErrors(rets);
                var errorsNumber = DBUtils.numFail(rets);
                var recordsGood = rets.length - errorsNumber;
                //console.log(errorsNumber);
                //console.log(recordsGood);
                var hadErrors = (errorsNumber == 0);
                //console.log(rets);
                AppUtils.log1('Batch #' + batchNumber + ' With Id: ' + batch.id + ' Finished - Success: ' + hadErrors + ' - Records Success: ' + recordsGood + ' Records Fail: ' + errorsNumber + ' - ' + numberOfBatchesDone + '/' + numberOfBatches + ' Batches have finished');
                if(resultData){
                  resultData.push({ ObjectName: objectName , RecordsFound: records.length , DeleteSuccess: hadErrors, RecordsSuccess: recordsGood, RecordsFail: errorsNumber});
                }
                  if(save){
                  DBUtils.saveResults(rets,batchNumber,objectName);
                }
                resolve("response");
              });
              //console.log('batch: '+ batch);
            }).catch(error => {
              AppUtils.log2('Error Creating  batches - Error: ' + error);
              if(resultData){
                resultData.push({ ObjectName: objectName , RecordsFound: records.length , DeleteSuccess: 'No Error: ' + error, RecordsSuccess: 'N/A', RecordsFail: 'N/A'});
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
            resultData.push({ ObjectName: objectName , RecordsFound: records.length , DeleteSuccess: 'No Error: ' + error, RecordsSuccess: 'N/A', RecordsFail: 'N/A'});
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
          if(element.success){
            return false;
          }
        }
        return true;
      }

      private static numFail(rets){
        var recordsFail = 0;
        for (let index = 0; index < rets.length; index++) {
          const element = rets[index];
          //console.log(element)
          if(!element.success){
            recordsFail = recordsFail + 1;
          }
        }
        return recordsFail;
      }
}