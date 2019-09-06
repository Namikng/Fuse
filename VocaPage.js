var Observable = require('FuseJS/Observable');
var Environment = require('FuseJS/Environment');

var util = require('Utils/Util');
var globals = require('Utils/Globals');
var logger = require('Utils/Logger');

var http = require('Server/Http');
var server = require('Server/ServerControl');

var Downloader = require('Downloader');
var settings = require('UserSettings');
var preference = require("Utils/UserPreference");

var loginInfo = require('pages/LoginPage');

var WANote = Observable("");
var RVNote = Observable("");
var RRVNote = Observable("");
var PMNote = Observable("");

//중복 방지용 변수
var prevent1 = false;
var prevent2 = false;

this.Parameter.onValueChanged(module, function(data) {
	if(data == undefined) return;

	genius_mode = preference.getGeniusMode();
	manage_no = preference.getMNO();
});

//ux파일이 Actived일때 작동
function onResume() {
	// logger.output("VocaPage onResume");
	if(Environment.mobile) {
		//인터넷 연결 확인
		var isConnected = http.isConnected();
		if(isConnected == false) {
			logger.output("Internet Not Connected");
			return;
		}

		prevent1 = true;
		globals.startLoading();

		if(genius_mode == 1) {
			var param = {"sdyrum_manage_no": manage_no};
			http.request(http.LISTEN_INFO_WORD2, param);
		} else {
			http.request(http.LISTEN_INFO_WORD1, {});
		}
	} else {
		prevent2 = true;

		server.requestListenListIncrct(param);
	}
}

//ux파일 inActive일때 실행됨
function onPause(){
	// logger.output("VocaPage onPause");

	prevent1 = false;
	prevent2 = false;

	WANote.value = "";
	RVNote.value = "";
	RRVNote.value = "";
	PMNote.value = "";

  // globals.stopLoading();
}

// 서버 통신 결과
// Downloader.onResult = function(response) {
http.resultListenInfoWord.onValueChanged(module, function(response) {
	if(response == undefined) return;

	if(prevent1) {
		var mResult = JSON.parse(response);
		var mData = JSON.parse(mResult);

		WANote.value = mData.result.info.WORD_NOTE_SE_1;
		if(WANote.value == null) WANote.value = 0;
		RVNote.value = mData.result.info.WORD_NOTE_SE_2;
		if(RVNote.value == null) RVNote.value = 0;
		RRVNote.value = mData.result.info.WORD_NOTE_SE_3;
		if(RRVNote.value == null) RRVNote.value = 0;
		PMNote.value = mData.result.info.WORD_NOTE_SE_4;
		if(PMNote.value == null) PMNote.value = 0;

		// logger.output("WANote: " + WANote.value);
		// logger.output("RVNote: " + RVNote.value);
		// logger.output("RRVNote: " + RRVNote.value);
		// logger.output("PMNote: " + PMNote.value);

		globals.stopLoading();

		prevent1 = false;
	}
});

//preview 서버통신
server.resultListenInfoWord.onValueChanged(module, function(data) {
	if(prevent2) {
		logger.output("LISTEN_LIST_INCRCT");
		logger.output("data : "+data);

		if(data == undefined) return;
		var mData = JSON.parse(data);
		var results = mData.result;

		// if(mData.rc == 0){
		// 	var tmp = [];
		// 	var list = results.myGeniusInfoList;

		// 	list.forEach(function(e) {
		// 		var photo = e.STDNT_PHOTO;
		// 		tmp.push({
		//
		// 		});
		// 	});
		// 	geniusList.replaceAll(tmp);
		// 	logger.output(tmp);
		// };
		prevent2 = false;
	}
});

function goToWrongVocaListPage() {
	router.pushRelative(rootNav, "vocaList", "AA540001");
}

function goToReVocaListPage() {
	router.pushRelative(rootNav, "vocaList", "AA540002");
}

function goToReReVocaListPage() {
	router.pushRelative(rootNav, "vocaList", "AA540003");
}

function goToPerfectVocaListPage() {
	router.pushRelative(rootNav, "vocaList", "AA540004");
}

module.exports = {
	onResume,
	onPause,
	goToWrongVocaListPage,
	goToReVocaListPage,
	goToReReVocaListPage,
	goToPerfectVocaListPage,
	WANote,
	RVNote,
	RRVNote,
	PMNote
};
