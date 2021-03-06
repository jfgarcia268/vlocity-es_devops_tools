export class AppUtils  {

    public static appVersion = require('../../package.json').version;

    public static namespace;

    public static ux;

    public static replaceaNameSpace(text) {
        //console.log('BEFORE:' + text);
        var res = text.replace(new RegExp('%name-space%', 'g'),this.namespace);
        //console.log('AFTER:' + res);
        return res;
    }

    public static replaceaNameSpaceFromFile(text) {
        //console.log('BEFORE:' + text);
        var res = text.replace(new RegExp('namespace__', 'g'),this.namespace);
        //console.log('AFTER:' + res);
        return res;
    }

    public static replaceaNameSpaceFromFileArray(array){
        var newArray = [];
        for (let index = 0; index < array.length; index++) {
            const element = array[index];
            newArray.push(this.replaceaNameSpaceFromFile(element));
        }
        return newArray;
    }

    public static async setNameSpace(conn,packageType) {
        if(packageType == 'cmt'){
            AppUtils.namespace = 'vlocity_cmt__';
        } else if(packageType == 'ins'){
            AppUtils.namespace = 'vlocity_ins__';
        } else if(!packageType) {
            var query = "Select Name, NamespacePrefix from ApexClass where Name = 'DRDataPackService'";
            const result = await conn.query(query);
            var nameSpaceResult = result.records[0].NamespacePrefix;
            if(nameSpaceResult) {
                this.namespace = nameSpaceResult + '__';
            }
        }
        return this.namespace;
    }

    public static logInitial(command: string) {
        this.log(' >>>> Vlocity ES Tools v' + AppUtils.appVersion + ' (BETA) <<<<');
        //this.log('');
        this.log3('Command: ' + command);
        //this.log('');
    }  

    public static log4(message) {
        this.log(' >>>> ' + message);
    }

    public static log3(message) {
        this.log('  >>> ' + message);
    }

    public static log2(message) {
        this.log('   >> ' + message);
    }

    public static log1(message) {
        this.log('    > ' + message);
    }

    public static startSpinner(message) {
        this.ux.startSpinner('   >> ' + message);
    }

    public static stopSpinnerMessage(message) {
        this.ux.stopSpinner(message);
    }

    public static stopSpinner() {
        this.ux.stopSpinner();
    }

    public static updateSpinnerMessage(message){
        this.ux.setSpinnerStatus(message);
    }

    private static log(message){
        if(this.ux != undefined){
            this.ux.log(message); 
        }
        else {
            console.log(message); 
        }
    }

    public static getDataByPath(data, path) {
        try {
            var pathArray = path.split(".");
            for(var i in pathArray) {
                data = data[pathArray[i]];
            }
            return data;   
        } catch (error) {
            return undefined;
        }
    }

}