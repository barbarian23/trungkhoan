import socketServer from "../../service/socket/socket.server.service";
import csvService from "../../service/csv/csv.server.service";
import {
    SOCKET_LOGIN,
    SOCKET_LOGIN_STATUS,
    SOCKET_GET_LIST_PHONE,
    SOCKET_LIST_PHONE,
    SOCKET_WORKING_SINGLE_NUMBER,
    SOCKET_WORKING_SOME_NUMBER,
    SOCKET_WORKING_ADDED_NUMBER,
    SOCKET_WORKING_ADDED_SOME_NUMBER,
    SOCKET_WORKING_DELETE_PHONE,
    SOCKET_WORKING_DELETED_PHONE,
    SOCKET_WORKING_EDITED_PHONE,
    SOCKET_WORKING_EDIT_PHONE,
    SOCKET_SETINTERVAL_PHONE,
    SOCKET_SETINTERVALED_PHONE,
    SOCKET_LOG
} from "../../../common/constants/common.constants";
import doLogin from "../work/login.controller";
import { HOME_URL, WAIT_TIME, MAXIMUM_INTERVAL } from "../../constants/work/work.constants";
import { getListTdTag, getListMiddleNumber, getListNumberMoney, verifyNumberPhone } from "../../service/util/utils.server";

const puppeteer = require('puppeteer');
//C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe
//C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe
let exPath = "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe";
var driver;

//biến đếm số lần chạy interval, nếu số lần chạy interval quá lướn, có thể khiến trình duyệt bị điw

var countInterval = 0, clearIntervalMax = null;

//selenium
// const webdriver = require('selenium-webdriver');
// const chrome = require('selenium-webdriver/chrome');
// var path = require('chromedriver').path;

// var service = new chrome.ServiceBuilder(path).build();
// chrome.setDefaultService(service);

// const chromeOption = new chrome.Options().addArguments("start-maximized") // open Browser in maximized mode
//     .addArguments("disable-infobars") // disabling infobars
//     .addArguments("--disable-extensions") // disabling extensions
//     .addArguments("--disable-gpu") // applicable to windows os only
//     .addArguments("--disable-dev-shm-usage")// overcome limited resource problems
//     .addArguments("--no-sandbox");



// w = webdriver.Chrome(executable_path="C:\\Users\\chromedriver.exe", chrome_options=options)

// var driver = new webdriver.Builder()
//     .setChromeOptions(chromeOption,executable_path="b").withCapabilities(webdriver.Capabilities.chrome()).build();

// var driver = new webdriver.Builder().forBrowser('chrome')
//     .setChromeOptions(chromeOption).withCapabilities(webdriver.Capabilities.chrome()).build();

//puppeteer


//socket
var socket = null;

// const seleniumInsstance = new seleniumCrawl();
const csvInstance = new csvService();

let arrayNumber = [
    // {
    //     number:"090090090",
    //     money:10000,
    //     interval:null,
    //     change:false,
    // }
];
try {
    arrayNumber = csvInstance.readFile();
} catch (e) {

}


const preparePuppteer = function () {
    return new Promise((res, rej) => {
        puppeteer.launch({
            args: ["--no-sandbox", "--proxy-server='direct://'", '--proxy-bypass-list=*'],
            headless: false,
            ignoreHTTPSErrors: true,
            executablePath: exPath == "" ? "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe" : exPath
        })
            .then(async (browser) => {
                let pageLogin = await browser.newPage();
                pageLogin.setViewport({ width: 2600, height: 3800 });

                res(pageLogin);
            }).catch(e => {
                rej(e);
            });

    });
}

const removeIntervalForLightenWeb = async () => {
    //cứ 2 phút 1 lần sẽ xem có bao nhiêu interval  đang chạy, nếu nhiều quá, hơn 300 thì refresh lại trangm rồi injejct hàm getPhone lại
    clearIntervalMax = setInterval(async () => {
        if (countInterval > MAXIMUM_INTERVAL) {
            // tải lại trang
            await driver.goto(HOME_URL);

            // wait to complete
            await driver.waitForFunction('document.readyState === "complete"');

            //inject hàm getPhone
            await inJectGetPhone();

        }
    }, WAIT_TIME * 2 + 15000); // sẽ là 2 phút 15 giây
}

const workingController = async function (server) {
    try {
        driver = await preparePuppteer();
        //khoi tao socket 
        socket = socketServer(server);
        socket.receive((receive) => {

            receive.on(SOCKET_LOGIN, login);

            //get list phone
            //trả về cho client danh sashc số đã lưu, đồng thời inject hàm getPhone vào trang web
            receive.on(SOCKET_GET_LIST_PHONE, getListPhone);

            // add number
            receive.on(SOCKET_WORKING_SINGLE_NUMBER, addNumber);

            // thêm sdt, số tiền qua file excel
            receive.on(SOCKET_WORKING_SOME_NUMBER, addSomeNumber);

            // delete sdt
            receive.on(SOCKET_WORKING_DELETE_PHONE, deletePhone);

            // edit sdt
            receive.on(SOCKET_WORKING_EDIT_PHONE, editPhone);

            // setinterval
            receive.on(SOCKET_SETINTERVAL_PHONE, setIntervalPhone);
        });
    } catch (e) {
        console.log("loi puppteer hoac socket", e);

    }
}

//lấy ra đoạn html bằng 1 đoạn javascript
const watchPhone = async (phone) => {
    return new Promise(async (res, rej) => {
        // let scriptGetPhone = 'async function action(){' +
        //     'function get(){' +
        //     'return new Promise((resolve,reject)=>{' +
        //     'try{' +
        //     'let first = document.querySelector("#ctl01 > div:nth-child(1)").getElementsByTagName("input");' +

        //     'let form = first[0].id + "=" + first[0].value + "&" + first[1].id + "=" + first[1].value + "&" + first[2].id + "=" + encodeURIComponent(first[2].value) + "&";' +


        //     'let second = document.querySelector("#ctl01 > div:nth-child(4)").getElementsByTagName("input");' +

        //     'form = form + second[0].id + "=" + encodeURIComponent(second[0].value) + "&ctl00%24MainContent%24msisdn=' + phone + '&ctl00%24MainContent%24submit_button=T%C3%ACm+ki%E1%BA%BFm";' +

        //     'let formData = new FormData();' +
        //     'formData.append("", form);' +
        //     'fetch("https://10.156.0.19/Account/Subs_info_120days.aspx", {' +
        //     'method: "POST",' +
        //     'headers: {' +
        //     '"Content-Type": "application/x-www-form-urlencoded",' +
        //     '},' +
        //     'body: formData,' +
        //     '})' +
        //     '.then(response => { console.log(response.text());return response.text(); })' +
        //     '.then(data => {' +
        //     'resolve(data);' +
        //     '})' +
        //     '.catch((error) => {' +
        //     'reject(e);' +
        //     '});' +
        //     '}catch (e) {' +
        //     'reject(e);' +
        //     '}' +
        //     '});' +
        //     '}' +
        //     'try {' +
        //     'let resultt = await get();' +
        //     'return resultt;' +
        //     '} catch (e) {' +
        //     'return null;' +
        //     '}' +
        //     '};' +

        //     'return await action()';
        try {
            //let html = await driver.evaluate("(async function (){return await getPhone("+phone+")}())");

            let html = await driver.evaluate("getPhone(" + phone + ")");

            //let html = await driver.executeScript(scriptGetPhone);

            // let html = await driver.evaluate(async (tPhone) => {
            //     console.log("phone is", tPhone);
            //     return await getPhone(tPhone);
            // }, phone);

            //await socket.send(SOCKET_LOG, { message: "html content", data: html });
            res(html);
        } catch (e) {
            console.log("error watchPhone", e);
            rej(e);
        }
    });
}

//lấy ra các thẻ table từ đoạn html
const getListTrInTable = async (htmlContent) => {
    return new Promise(async (res, rej) => {
        let listTrTag = await getListTdTag(htmlContent);
        //await socket.send(SOCKET_LOG, { message: "list tr", data: listTrTag });
        res(listTrTag);
    });
}

//lấy ra number có thể kèm theo các ký tự đặc biệt như ><
const getMiddleNumber = (listTr) => {
    return new Promise(async (res, rej) => {
        let numberWithSpecial = await getListMiddleNumber(listTr);
        //await socket.send(SOCKET_LOG, { message: "number uiwth spcial tr", data: numberWithSpecial });
        res(numberWithSpecial);
    });
}

//lấy ra number từ 1 đoạn string có chứa số kèm theo 1 số ký tư đặc gbiejet như b><
const getNumberMoney = (numberSpecial) => {
    return new Promise(async (res, rej) => {
        let number = await getListNumberMoney(numberSpecial);
        //await socket.send(SOCKET_LOG, { message: "number", data: number });
        res(number);
    });
}

const getNumberInfo = async (phone) => {
    //let rd = Math.floor(Math.random() * 10);
    //console.log("number random", rd);
    return new Promise(async (res, rej) => {
        try {
            //lấy ra đoạn html
            let htmlContent = await watchPhone(phone);
            //console.log("htmlContent", htmlContent.length);
            //lấy ra các tr
            let listTr = await getListTrInTable(htmlContent);
            //console.log("listTr", listTr.length);
            //lấy ra số điện thoại, có thể bao gồm với các ngoặc ><. dùng tr thứ 5
            let numberSpecial = await getMiddleNumber(listTr[5]);
            //console.log("numberSpecial", numberSpecial[0]);
            //lấy ra number
            let number = await getNumberMoney(numberSpecial[0]);
            console.log("phone", phone, "money", number[0]);

            res(number[0]);

        } catch (e) {
            console.log("getNumberInfo error", e);
        }
    });
}

let random = () => {
    let rd = Math.floor(Math.random() * 10);
    console.log("number random", rd);
    return rd;
}

const inJectGetPhone = async () => {
    try{
    let stringF = 'window.getPhone = async (phone) => {' +
            'console.log(phone);' +
            'async function action(){' +
            'function get(){' +
            'return new Promise((resolve,reject)=>{' +
            'try{' +
            'let first = document.querySelector("#ctl01 > div:nth-child(1)").getElementsByTagName("input");' +

            'let form = first[0].id + "=" + first[0].value + "&" + first[1].id + "=" + first[1].value + "&" + first[2].id + "=" + encodeURIComponent(first[2].value) + "&";' +


            'let second = document.querySelector("#ctl01 > div:nth-child(4)").getElementsByTagName("input");' +

            'form = form + second[0].id + "=" + encodeURIComponent(second[0].value) + "&ctl00%24MainContent%24msisdn="+phone+"&ctl00%24MainContent%24submit_button=T%C3%ACm+ki%E1%BA%BFm";' +

            'let formData = new FormData();' +
            'formData.append("", form);' +
            'fetch("https://10.156.0.19/Account/Subs_info_120days.aspx", {' +
            'method: "POST",' +
            'headers: {' +
            '"Content-Type": "application/x-www-form-urlencoded",' +
            '},' +
            'body: formData,' +
            '})' +
            '.then(response => { return response.text(); })' +
            '.then(data => {' +
            'resolve(data);' +
            '})' +
            '.catch((error) => {' +
            'console.log("fetch eror",error);' +
            'reject(error);' +
            '});' +

            '}catch (e) {' +
            'console.log("try catch above",e);' +
            'reject(e);' +
            '}' +
            '});' +
            '}' +
            'try {' +
            'let resultt = await get();' +
            'return resultt;' +
            '} catch (e) {' +
            'return null;' +
            '}' +
            '};' +

            'return await action()' +
            '}';

        await driver.evaluate(stringF);
    }catch(e){
        console.log("inject getPhone error",e);
    }
}

const login = function (data) {
    console.log("login voi username va password", data.username, data.password);
    doLogin(data.username, data.password, socket, driver);
}

const getListPhone = async function (data) {
    //console.log("getListPhone", data);
    socket.send(SOCKET_LIST_PHONE, arrayNumber);
}

const findIndex = num => {
    let tempIndex = -1;
    arrayNumber.some((item, index) => {
        if (item.phone == num) {
            tempIndex = index;
            return true;
        }
    });
    return tempIndex;
}

const duplicateNumber = num => {
    let bool = false;
    bool = arrayNumber.some((item) => {
        if (item.phone == num)
            return true;
    });
    return bool;
}
const addNumber = async function (data) {

    //kiểm tra có bị trùng
    console.log("duplicate ", duplicateNumber(data.phone));
    if (duplicateNumber(data.phone) == false) {
        // console.log("verifyNumberPhone data.phone", verifyNumberPhone(data.phone));
        data.phone = verifyNumberPhone(data.phone);
        //console.log("data.phone", data.phone);
        arrayNumber.push(data);
        //console.log("theem soos", arrayNumber[arrayNumber.length - 1]);
        let tempIndex = arrayNumber.length - 1; // 3
        // console.log()
        socket.send(SOCKET_WORKING_ADDED_NUMBER, { status: 200, data: data });

        //gọi lại lần đầu
        data.info = await getNumberInfo(data.phone);
        await socket.send(SOCKET_SETINTERVALED_PHONE, { info: data.info, index: tempIndex, phone: data.phone });

        arrayNumber[tempIndex].interval = setInterval(async () => { // xoa 3 >> clear interval 3
            //lúc thêm mới thì cần thận với cái arrayNumber.length này
            let idx = findIndex(data.phone);
            //console.log("interval new", idx, arrayNumber[idx].phone);
            //arrayNumber[idx].info = await getNumberInfo();
            countInterval++;
            arrayNumber[idx].info = await getNumberInfo(arrayNumber[idx].phone);
            await socket.send(SOCKET_SETINTERVALED_PHONE, { info: arrayNumber[idx].info, index: idx, phone: data.phone });
        }, WAIT_TIME + tempIndex);
        csvInstance.writeFile(arrayNumber);
    } else {
        socket.send(SOCKET_WORKING_ADDED_NUMBER, { status: "Số điện thoại đã tồn tại", data: null });
    }

}

const addSomeNumber = function (data) {
    //console.log("theem nhieu soos", data);
    //kiểm tra có bị trùng
    arrayNumber.push(data);
    socket.send(SOCKET_WORKING_ADDED_SOME_NUMBER, data);
}

const deletePhone = function (data) {
    console.log("delete with phone and money", data);
    console.log("list number from server", arrayNumber);
    clearInterval(arrayNumber[data.index].interval);
    arrayNumber.splice(data.index, 1);
    csvInstance.writeFile(arrayNumber);
    socket.send(SOCKET_WORKING_DELETED_PHONE, { index: data.index });
}

const editPhone = function (data) {
    arrayNumber[data.index].phone = data.phone;
    arrayNumber[data.index].money = data.money;
    csvInstance.writeFile(arrayNumber);
    socket.send(SOCKET_WORKING_EDITED_PHONE, { index: data.index, phone: data.phone, money: data.money });
}


//hàm này chạy đầu tiên, nên hàm này sẽ inject hàm getPhone vào trang web, và khởi tạo một interval chuyên dọn dẹp các interval để giảm thiêu dung lượn cho trang web
const setIntervalPhone = async function (data) {
    try {
        await inJectGetPhone();

        await removeIntervalForLightenWeb();

        await socket.send(SOCKET_LOG, { message: "setIntervalPhone" });
        //console.log("data in server", arrayNumber);
        arrayNumber.forEach(async (item, index) => {
            item.info = await getNumberInfo(item.phone);
            await socket.send(SOCKET_SETINTERVALED_PHONE, { info: item.info, index: index, phone: item.phone });

            item.interval = setInterval(async () => {
                //item.info = await getNumberInfo();
                countInterval++;
                item.info = await getNumberInfo(item.phone);
                let idx = findIndex(item.phone);
                await socket.send(SOCKET_SETINTERVALED_PHONE, { info: item.info, index: idx, phone: item.phone });
            }, WAIT_TIME + index);
        });
    } catch (e) {
        await socket.send(SOCKET_LOG, { message: "loi " + e });
    }
}
export default workingController;