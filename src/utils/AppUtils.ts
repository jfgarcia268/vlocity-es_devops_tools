
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

    public static logInitial(command: string) {
        this.log('');
        this.log(' >>>> Vlocity ES Tools v' + AppUtils.appVersion + ' (BETA)  <<<<');
        this.log('');
        this.log3('Command: ' + command);
    }  

    public static log3(message) {
        this.log(' >>> ' + message);
    }

    public static log2(message) {
        this.log('   >> ' + message);
    }

    public static log1(message) {
        this.log('     > ' + message);
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

}
