"use strict";

function PDFViewer() {
	this.fileName = "";
	this.centerPage = false;
	this.pageNumber = 1;
	this.posDupletArray = 0;
	this.pagesRendering = false;
	this.docLoadDone = false;
	this.pageDupletToRender = [];
	this.pageDuplets = [];
	this.searchIndex = [];
	this.currentPages = [];
	this.rotateAngle = [0, 0];
	this.docIndex = [];
	this.scale = 1;
	this.offsetScale = 1;
	this.zoomMode = false;
	this.cnvs = [	document.getElementById("pdf-renderer1"),
					document.getElementById("pdf-renderer2")];
	this.ctx = [	this.cnvs[0].getContext('2d', {"willreadfrequently":"true"}), 
					this.cnvs[1].getContext('2d', {"willreadfrequently":"true"})];
	this.dragElement(document.getElementById("pdf-searchbar"));
	this.dragElement(document.getElementById("pdf-page-container"));
	this.sDocBaseURL = window.location.href.substring(0, window.location.href.indexOf("ebook.html")).replace("bs_navi_test", "bs_navi");
	this.sBaseURL = window.location.href.substring(0, window.location.href.indexOf("ebook.html"));
	this.init();
};

PDFViewer.prototype.init = function() {
	let wmax  = window.innerWidth || document.documentElement.clientWidth || 
					document.body.clientWidth;
	let hmax = window.innerHeight|| document.documentElement.clientHeight|| 
					document.body.clientHeight;
	this.midW = parseInt(wmax / 2);
	this.midH = parseInt(hmax / 2);
	/* Get arguments from URL > p=x for pagenumber, d=y for documentid and s=z for searchterm */
	let args = this.getArgs();
	/* If no documentid was provided terminate and show error */
	if("" == args.doc) {
		this.showMessage("Keine Dokument-ID angegeben");
		return;
	}
	/* Add margin to body the height of the navbar */
	this.setTopMargin();
	/* Specify worker source */
	pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';
	/* Load document list */
	this.loadDataAsync(this.sBaseURL + "json/docs.json?v=" + ((Math.random() * 100000) % 10000))
		.then((data) => {
			this.docIndex = data;
			/*console.dir(data);*/
			/* Look up provided document id in the list */
			let docElem = this.docIndex.find(function(oElem) { return oElem.UID == args.doc;});
			if(undefined !== docElem) {
				/* Forward external links */
				if(docElem.link.startsWith("https://wictip.wicona.com")) {
					window.location.href = docElem.link;
					return;
				}
				/* Set pagetitle */
				this.setPageTitle(docElem.title);
				this.setPageIcon(docElem.ico);
				/* Load document structure and searchterms */
				this.loadDataAsync(this.sBaseURL + "json/" + docElem.UID + ".json?v=" + ((Math.random() * 100000) % 10000))
				.then((data) => {
					this.pageDuplets = data.pageduplets;
					this.searchIndex = data.searchindex;
					if(data.hasOwnProperty("toc")) {
						this.showTableOfContent(data.toc);
					}
					/* Generate document link */
					this.fileName = docElem.link.substring(docElem.link.lastIndexOf('/') + 1, docElem.link.indexOf('?') - 4);
					let sDocURL = this.sDocBaseURL + docElem.link.substring(3);
					this.sDocURL = sDocURL;
					/* Set link of download button */
					document.getElementById("pdf-download").href = sDocURL;
					//console.dir(this.sDocBaseURL + docElem.link.substring(3));
					/* Load document proxy */
					pdfjsLib.getDocument(sDocURL).promise.then(pdfDoc_ => {
						this.pdfDoc = pdfDoc_;
						/* Hide loading animation */
						document.getElementsByClassName("pdf-roller")[0].classList.add("pdf-hide");
						/* If pagenumber has been provided go to that page, else to 1 */
						if(args.page == "") {
							this.moveTo(1)
						} else {
							this.moveTo(args.page);
						}
						/* If a searchterm has been provided search it */
						if(args.search != "") {
							this.searchFor(args.search);
						}
						/* Link the controls with the functions */
						this.initControls();
						/* Load document with pdf-lib to extract pages for download */
						this.loadInPdfLib();
					});
				})
				.catch((reason) => console.log("[!] " + reason.message));
			} else {
				this.showMessage("Ungültige Dokument-ID angegeben");
			}
		})
		.catch((reason) => console.log("[!] " + reason.message));
};

PDFViewer.prototype.loadInPdfLib = function() {
	this.pdfLibLoad().then(() => {
		this.docLoadDone = true;
		/*console.log("pdf loaded");*/
	});
};

PDFViewer.prototype.pdfLibLoad = async function() {
	let oPDFDonorBytes = await fetch(this.sDocURL).then(res => res.arrayBuffer());
	this.oPDFDonorDoc = await PDFLib.PDFDocument.load(oPDFDonorBytes,{ignoreEncryption:true});
};

PDFViewer.prototype.setTopMargin = function() {
	let iOffset = document.getElementsByClassName("pdf-navbar")[0].clientHeight;
	document.getElementById("pdf-viewer").style.top = iOffset + "px";
};

PDFViewer.prototype.showMessage = function(sMsg) {
	/* Clear main container and display message */
	let oSC = document.getElementsByClassName("pdf-roller-container")[0];
	this.clearElem(oSC);
	oSC.appendChild(document.createTextNode(sMsg));
};

PDFViewer.prototype.showTableOfContent = function(oData) {
	let oCon = document.getElementById("pdf-toc");
	this.clearElem(oCon);
	let oTitle = document.createElement("DIV");
	let oTitleText = document.createTextNode("Inhalt");
	oTitle.appendChild(oTitleText);
	oTitle.classList.add("pdf-toc-title");
	oCon.appendChild(oTitle);
	for(let i = 0; i < oData.length; i++) {
		if(!oData[i].hasOwnProperty("title") || !oData[i].hasOwnProperty("content")) return;
		let oMain = document.createElement("DIV");
		let oMainIcon = document.createElement("I");
		oMainIcon.classList.add("fa");
		oMainIcon.classList.add("fa-chevron-right");
		oMainIcon.classList.add("pdf-toc-chapter" + i + "-icon");
		oMainIcon.style.marginRight = "5px";
		oMainIcon.style.fontSize = "0.8em";
		oMain.appendChild(oMainIcon);
		let oMainText = document.createTextNode(oData[i].title);
		oMain.appendChild(oMainText);
		oMain.classList.add("pdf-toc-chapter" + i);
		oMain.onclick = function() { this.toggleChapter("pdf-toc-chapter" + i); }.bind(this);
		oCon.appendChild(oMain);
		if(27 < oData[i].title.length) {
			oMain.onmouseover = function(e) { this.showTooltip(e, oData[i].title); }.bind(this);
			oMain.onmouseout = function() { this.hideTooltip(); }.bind(this);
		}
		for(let j = 0; j < oData[i].content.length; j++) {
			let oAnc = document.createElement("DIV");
			let oText;
			if(oData[i].content[j].hasOwnProperty("subtitle")) {
				oText = document.createTextNode(oData[i].content[j].subtitle);
				if(27 < oData[i].content[j].subtitle.length) {
					oAnc.onmouseover = function(e) { this.showTooltip(e, oData[i].content[j].subtitle); }.bind(this);
					oAnc.onmouseout = function() { this.hideTooltip(); }.bind(this);
				}
				oAnc.classList.add("pdf-toc-subtitle");
			} else {
				oText = document.createTextNode(oData[i].content[j].str);
				oAnc.onclick = function() { this.moveTo(oData[i].content[j].pageNum); }.bind(this);
				if(27 < oData[i].content[j].str.length) {
					oAnc.onmouseover = function(e) { this.showTooltip(e, oData[i].content[j].str); }.bind(this);
					oAnc.onmouseout = function() { this.hideTooltip(); }.bind(this);
				}
			}
			oAnc.appendChild(oText);
			oAnc.classList.add("pdf-toc-chapter" + i + "-item");
			oAnc.classList.add("pdf-hide");
			oAnc.style.paddingLeft = "10px";
			oCon.appendChild(oAnc);
		}
		
	}
	if(1 == oData.length) {
		/* Bei nur einem Kapitel dieses automatisch aufklappen */
		this.toggleChapter("pdf-toc-chapter0");
	}
};

PDFViewer.prototype.getArgs = function() {
	/* Prepare empty return structure */
	let args = {"doc":"","search":"","page":""};
	/* If the URL doesn't contain a '?' there are no arguments sent */
	if(!window.location.href.includes("?")) return args;
	/* Take the part of the URL behind the '?' and split it at '&' */
	let argsTemp = window.location.href.substring(window.location.href.indexOf("?") + 1).split("&");
	/* Parse each of the slices */
	for(let i = 0; i < argsTemp.length; i++) {
		if(argsTemp[i].includes("=")) {
			let varPair = argsTemp[i].split("=");
			switch(varPair[0]) {
				case "p":
				case "P": args.page = varPair[1]; break;
				case "d":
				case "D": args.doc = varPair[1]; break;
				case "s":
				case "S": args.search = varPair[1]; break;
			}
		}
	}
	return args;
};

PDFViewer.prototype.clearElem = function(oElem) {
	if(undefined == oElem) return;
	while(oElem.lastChild)
		oElem.removeChild(oElem.lastChild);
};

PDFViewer.prototype.loadDataAsync = async function(sURL) {
	/* Load data from given URL */
	let response = await fetch(sURL);
	let data = await response.json();
	return data;
};

PDFViewer.prototype.showTooltip = function(e, sText) {
	let oTt = document.createElement("div");
	let oTn = document.createTextNode(sText);
	oTt.classList.add("pdf-tooltip");
	oTt.style.left = e.clientX + "px";
	oTt.style.top = e.clientY + "px";
	oTt.appendChild(oTn);
	document.getElementsByTagName("body")[0].appendChild(oTt);
};

PDFViewer.prototype.hideTooltip = function() {
	document.getElementsByTagName("body")[0].removeChild(document.getElementsByClassName("pdf-tooltip")[0]);
};

PDFViewer.prototype.loadPages = function(numPage1 = null, numPage2 = null) {
	/* Block rendering while there is a page render in progress */
	this.pagesRendering = true;
	let loadingDocs = [];
	/* Add loading tasks to iteratable */
	if(null != numPage1) {
		loadingDocs.push(this.pdfDoc.getPage(numPage1));
	}
	if(null != numPage2) {
		loadingDocs.push(this.pdfDoc.getPage(numPage2));
	}
	/* Load all pages, then proceed */
	Promise.all(loadingDocs).then((pages) => {
		/* Save current pageproxy for rerendering */
		this.currentPages = [null, null];
		for(let i = 0; i < pages.length; i++) {
			this.currentPages[i] = pages[i];
		}
		/* Render loaded pages */
		let scale = this.calculateScaleToFitSite(pages);
		this.scale = scale;
		this.ctx[0].canvas.hidden = true;
		this.ctx[1].canvas.hidden = true;
		Promise.all(	[this.getRenderPromise(0,  this.currentPages[0], scale),
						this.getRenderPromise(1,  this.currentPages[1], scale)])
		.then((test) => {
			this.pagesRendering = false;
			this.updatePageCount();
			this.turnPage(0);
			this.turnPage(1);
		}).catch((err) => console.log("[!] " + err.message));
	})
	.catch((reason) => console.log("[!] " + reason.message));

};

PDFViewer.prototype.renderPages = function() {
	/* If the pages already have been loaded proceed with rendering it in the new scale */
	if(this.currentPages.length > 0) {
		this.pagesRendering = true;
		let pages = this.currentPages;
		this.ctx[0].canvas.hidden = true;
		this.ctx[1].canvas.hidden = true;
		Promise.all(	[this.getRenderPromise(0,  this.currentPages[0], this.scale),
						this.getRenderPromise(1,  this.currentPages[1], this.scale)])
		.then((test) => {
			this.pagesRendering = false;
			this.updatePageCount();
			this.turnPage(0);
			this.turnPage(1);
			this.doneRendering();
		}).catch((err) => console.log("[!] " + err.message));
	} else {
		/* Load pages, then proceed to render */
		let pDup = this.pageDuplets[this.posDupletArray];
		this.loadPages(pDup[0], pDup[1]);
	}
};

PDFViewer.prototype.getRenderPromise = function(iCnv, page, scale) {
	let ctx = this.ctx[iCnv];
	let cnv = this.cnvs[iCnv];
	return new Promise((resolve, reject) => {
		if(null == page) resolve(null);
		let vp = page.getViewport({scale: scale});
		/*console.dir(page);*/
		cnv.height = (page.view[3] - page.view[1]) * scale;
		cnv.width = (page.view[2] - page.view[0]) * scale;
		let renderContext = {
			canvasContext: ctx,
			viewport: vp
		}
		page.render(renderContext).promise.then(() => {
			ctx.canvas.hidden = false;
			resolve(null);
		});
		
	});
};

PDFViewer.prototype.doneRendering = function() {
	
	if(this.centerPage) {
		const hnb = document.getElementsByClassName("pdf-navbar")[0].clientHeight;
		const wmax  = window.innerWidth || document.documentElement.clientWidth || 
						document.body.clientWidth;
		const hmax = (window.innerHeight|| document.documentElement.clientHeight || 
						document.body.clientHeight) - hnb;
		let oBody = document.getElementsByTagName("body")[0];
		let oPC = document.getElementById("pdf-page-container");
		oPC.style.transform = "translate(0px,0px)";
		/*oPC.style.left = parseInt((wmax - oPC.clientWidth) / 2) + "px";
		oPC.style.top = parseInt((hmax - oPC.clientHeight) / 2) + "px";*/
		oPC.style.left = "";
		oPC.style.top = "";
		this.centerPage = false;
	}
};

PDFViewer.prototype.calculateScaleToFitSite = function(aPagesTemp) {
	const wmax  = window.innerWidth || document.documentElement.clientWidth || 
					document.body.clientWidth;
	const hmax = (window.innerHeight|| document.documentElement.clientHeight || 
					document.body.clientHeight) - 
					document.getElementsByClassName("pdf-navbar")[0].clientHeight;
	let aPages = [];
	for(let i = 0; i < aPagesTemp.length; i++)
		if(null != aPagesTemp[i])
			aPages.push(aPagesTemp[i]);
	if(aPages.length == 1) {
		let w = aPages[0].view[2] - aPages[0].view[0];
		let h = aPages[0].view[3] - aPages[0].view[1];
		let scaleh = parseFloat(wmax - 20) / parseFloat(w);
		let scalev = parseFloat(hmax - 20) / parseFloat(h);
		return Math.round((Math.min(scaleh, scalev) + Number.EPSILON) * 100) / 100;
	} else if(aPages.length == 2) {
		let w = (aPages[0].view[2] - aPages[0].view[0]) + (aPages[1].view[2] - aPages[1].view[0]);
		let h = Math.max((aPages[0].view[3] - aPages[0].view[1]), (aPages[0].view[3] - aPages[0].view[1]));
		let scaleh = parseFloat(wmax - 20) / parseFloat(w);
		let scalev = parseFloat(hmax - 20) / parseFloat(h);
		return Math.round((Math.min(scaleh, scalev) + Number.EPSILON) * 100) / 100;
	}
	return 1;
};

PDFViewer.prototype.queueRenderPages = function(iPos) {
	if(this.pagesRendering) {
		this.pageDupletToRender.push(iPos);
	} else {
		let pages = this.pageDuplets[iPos];
		this.loadPages(pages[0], pages[1]);
	}
	this.vertPages();
};

PDFViewer.prototype.zoomIn = function() {
	if(this.scale > 2.25) return;
	this.scale += 0.25;
	this.offsetScale += 0.25
	this.renderPages();
};

PDFViewer.prototype.zoomOut = function() {
	if(this.scale <= 0.5) return;
	this.scale -= 0.25;
	this.offsetScale -= 0.25
	this.renderPages();
};

PDFViewer.prototype.zoomFit = function() {
	this.scale = this.calculateScaleToFitSite(this.currentPages);
	this.renderPages();
	this.centerPage = true;
};

PDFViewer.prototype.goToPage = function(e) {
	if("Enter" != e.key) return;
	let oPageViewer = document.getElementById("pdf-current-site");
	let x = oPageViewer.value;
	oPageViewer.value = "";
	oPageViewer.blur();
	this.moveTo(x);
};

PDFViewer.prototype.moveTo = function(sPage) {
	if(isNaN(sPage)) return;
	this.pageNumber = parseInt(sPage);
	/*console.dir(this.pageDuplets);*/
	let oPageDuplet = this.pageDuplets.filter(this.containsPageNumber.bind(this));
	if(0 == oPageDuplet.length) return;
	/*console.dir(oPageDuplet);*/
	this.posDupletArray = this.pageDuplets.indexOf(oPageDuplet[0]);
	this.queueRenderPages(this.posDupletArray);
};

PDFViewer.prototype.searchFor = function(sSearchTerm) {
	if(undefined == sSearchTerm) return;
	this.sSearchTerm = sSearchTerm;
	let oSearchResultContainer = document.getElementById("pdf-searchresults");
	document.getElementById("pdf-search").value = sSearchTerm;
	let oResArray = this.searchIndex.filter(this.containsSearchTerm.bind(this));
	oResArray.forEach((oElem) => {
		let oAnc = document.createElement("DIV");
		oAnc.onclick = function() {this.moveTo(oElem.pageNum);}.bind(this);
		oAnc.style.cursor = "pointer";
		oAnc.appendChild(document.createTextNode("S" + oElem.pageNum + ": " + oElem.str));
		oSearchResultContainer.appendChild(oAnc);
	});
};

PDFViewer.prototype.hideSearchbox = function() {
	let oSB = document.getElementById("pdf-searchbar");
	let oTB = document.getElementById("pdf-searchbar-toggle").firstChild;
	if(!oSB.classList.contains("pdf-hide")) {
		oSB.classList.add("pdf-hide");
		oTB.classList.add("fa-eye");
		oTB.classList.remove("fa-eye-slash");
	}
};

PDFViewer.prototype.toggleSearchboxVis = function() {
	let oSB = document.getElementById("pdf-searchbar");
	let oTB = document.getElementById("pdf-searchbar-toggle").firstChild;
	if(oSB.classList.contains("pdf-hide")) {
		oSB.classList.remove("pdf-hide");
		oTB.classList.remove("fa-eye");
		oTB.classList.add("fa-eye-slash");
	} else {
		oSB.classList.add("pdf-hide");
		oTB.classList.add("fa-eye");
		oTB.classList.remove("fa-eye-slash");
	}
};

PDFViewer.prototype.toggleChapter = function(sChapter) {
	let oIco = document.getElementsByClassName(sChapter + "-icon")[0];
	let oItmArr = document.getElementsByClassName(sChapter + "-item");
	if(oIco.classList.contains("fa-chevron-right")) {
		for(let i = 0; i < oItmArr.length; i++) {
			oItmArr[i].classList.remove("pdf-hide")
		}
		oIco.classList.remove("fa-chevron-right");
		oIco.classList.add("fa-chevron-down");
	} else {
		for(let i = 0; i < oItmArr.length; i++) {
			oItmArr[i].classList.add("pdf-hide")
		}
		oIco.classList.remove("fa-chevron-down");
		oIco.classList.add("fa-chevron-right");
	}
};

PDFViewer.prototype.vertPages = function() {
	this.rotateAngle = [0, 0];
	this.cnvs[0].style.transform = "rotate(0deg)";
	this.cnvs[1].style.transform = "rotate(0deg)";
};

PDFViewer.prototype.turnPage = function(iPage) {
	let oPD = this.pageDuplets[this.posDupletArray];
	let bOnePage = false;
	if(oPD[0] == null || oPD[1] == null) {
		bOnePage = true;
	}
	if(this.ctx[iPage].canvas.hidden == true) {
		iPage = 1 - iPage /* swith 0 to 1 or 1 to 0 */
	}
	if(this.ctx[iPage].canvas.hidden == true) return; /* both canvas elements hidden */
	this.cnvs[iPage].style.transform = "rotate(" + this.rotateAngle[iPage] + "deg)";
	if(!bOnePage && ((Math.abs(this.rotateAngle[iPage]) == 90) || (Math.abs(this.rotateAngle[iPage]) == 270))) {
		var iOffset = ((this.cnvs[0].height - this.cnvs[0].width) / 2)
		if(iPage == 0) {
			this.cnvs[0].style.transform = "translateX(-" + iOffset + "px) rotate(" + this.rotateAngle[iPage] + "deg)";
		} else {
			this.cnvs[1].style.transform = "translateX(+" + iOffset + "px) rotate(" + this.rotateAngle[iPage] + "deg)";
		}
	}
};

PDFViewer.prototype.rotateCW = function(iPage) {
	this.rotateAngle[iPage] = (this.rotateAngle[iPage] + 90) % 360;
	this.turnPage(0);
	this.turnPage(1);
};

PDFViewer.prototype.rotateCCW = function(iPage) {
	this.rotateAngle[iPage] = (this.rotateAngle[iPage] - 90) % 360;
	this.turnPage(0);
	this.turnPage(1);
};

PDFViewer.prototype.downloadPage = async function(iInd) {
	if(0 > iInd || 1 < iInd) return;
	
	let oPD = this.pageDuplets[this.posDupletArray];
	if(null == oPD[iInd]) iInd = 1 - iInd;
	let iPage = oPD[iInd] - 1;
	let oPDFDoc = await PDFLib.PDFDocument.create();
	/*console.dir(this.sDocURL);*/
	let [oPage] = await oPDFDoc.copyPages(this.oPDFDonorDoc, [iPage]);
	oPDFDoc.addPage(oPage);
	let oPDFBytes = await oPDFDoc.save();
	download(oPDFBytes, this.fileName + "_page" + (iPage + 1), "application/pdf");
};

PDFViewer.prototype.initControls = function() {
	document.getElementById("pdf-searchbar-toggle").onclick = function() {this.toggleSearchboxVis()}.bind(this);
	document.getElementById("pdf-hide-searchbar").onclick = function() {this.hideSearchbox()}.bind(this);
	document.getElementById("pdf-previous-site").onclick = function() {this.getPrevPages()}.bind(this);
	document.getElementById("pdf-next-site").onclick = function() {this.getNextPages()}.bind(this);
	document.getElementById("pdf-first-site").onclick = function() {this.getFirstPages()}.bind(this);
	document.getElementById("pdf-last-site").onclick = function() {this.getLastPages()}.bind(this);
	document.getElementById("pdf-current-site").onkeyup = function(e) { this.goToPage(e); }.bind(this);
	document.getElementById("pdf-zoom-in").onclick = function() {this.zoomIn()}.bind(this);
	document.getElementById("pdf-zoom-out").onclick = function() {this.zoomOut()}.bind(this);
	document.getElementById("pdf-search").onkeypress = function(e) {this.searchController(e)}.bind(this);
	document.getElementById("pdf-turn-left-ccw").onclick = function() {this.rotateCCW(0)}.bind(this);
	document.getElementById("pdf-turn-right-ccw").onclick = function() {this.rotateCCW(1)}.bind(this);
	document.getElementById("pdf-turn-left-cw").onclick = function() {this.rotateCW(0)}.bind(this);
	document.getElementById("pdf-turn-right-cw").onclick = function() {this.rotateCW(1)}.bind(this);
	document.getElementById("pdf-zoom-fit").onclick = function() {this.zoomFit()}.bind(this);
	document.getElementById("pdf-download-left").onclick = function() {this.downloadPage(0)}.bind(this);
	document.getElementById("pdf-download-right").onclick = function() {this.downloadPage(1)}.bind(this);
	document.getElementById("pdf-searchbar").addEventListener("wheel", (event) => event.stopPropagation());
	document.getElementById("pdf-viewer").ondblclick = function() {
		this.zoomMode = !this.zoomMode;
		if(this.zoomMode) {
			document.body.style.cursor = "zoom-in";
			let oElem = document.getElementById("pdf-page-container");
			oElem.zoomLevel = 1.0;
			oElem.offX = 0;
			oElem.offY = 0;
		} else {
			document.body.style.cursor = "default";
			this.zoomFit();
			let oElem = document.getElementById("pdf-page-container");
			oElem.zoomLevel = 1.0;
			oElem.offX = 0;
			oElem.offY = 0;
		}
	}.bind(this);
	window.addEventListener("wheel", (event) => {
		/*console.dir(event);*/
		if("zoom-in" == document.body.style.cursor) {
			event.stopPropagation();
			if(event.wheelDeltaY > 0) {
				/* Turn up = zoom in */
				this.zoomWithOrigin(event, true);
			} else {
				this.zoomWithOrigin(event, false);
			}
		} else {
			if(event.wheelDeltaY > 0) {
				this.getPrevPages();
			} else {
				this.getNextPages();
			}
		}
	});
};

PDFViewer.prototype.zoomWithOrigin = function(e, bZoomIn) {
	let oElem = document.getElementById("pdf-page-container");
	let dZoomStep = 0.2;
	
	let aOff;
	if(bZoomIn) {
		this.scale = this.scale + dZoomStep;
		aOff = this.getOffset(e, oElem, dZoomStep);
		oElem.offX = oElem.offX - aOff[0];
		oElem.offY = oElem.offY - aOff[1];
		oElem.style.transform = "translate(" + oElem.offX + "px, " + oElem.offY + "px)";
	} else {
		this.scale = this.scale - dZoomStep;
		aOff = this.getOffset(e, oElem, (-1 * dZoomStep));
		oElem.offX = oElem.offX - aOff[0];
		oElem.offY = oElem.offY - aOff[1];
		oElem.style.transform = "translate(" + oElem.offX + "px, " + oElem.offY + "px)";
	}
	
	if(!this.pagesRendering)
		this.renderPages();
	
};


PDFViewer.prototype.getOffset = function(e, oElem, dZoomStep) {
	let oTest = {};
	let aElemOff = oElem.getBoundingClientRect();
	let iElemMidX = aElemOff.left + (aElemOff.width / 2);
	let iElemMidY = aElemOff.top + (aElemOff.height / 2);
	let iMouseOffX = e.x - iElemMidX;
	let iMouseOffY = e.y - iElemMidY;
	let iOffX = parseInt(((1 + dZoomStep) *  iMouseOffX) - iMouseOffX);
	let iOffY = parseInt(((1 + dZoomStep) *  iMouseOffY) - iMouseOffY);
	/*this.showMidElement(oElem, "#000");
	this.showPredictedMousePosition(e, oElem, iMouseOffX, iMouseOffY, "#ff0000");
	this.showPredictedMousePosition(e, oElem, oElem.zoomLevel * iMouseOffX, oElem.zoomLevel * iMouseOffY, "#00ff00");
	this.showPredictedMidPoint(e, oElem, (oElem.zoomLevel * iMouseOffX) - iMouseOffX, (oElem.zoomLevel * iMouseOffY) - iMouseOffY, "#0000ff");*/
	return [iOffX, iOffY];
};
/*
PDFViewer.prototype.showMidElement = function(oElem, sCol) {
	let aElemOff = oElem.getBoundingClientRect();
	let iElemMidX = aElemOff.left + (aElemOff.width / 2);
	let iElemMidY = aElemOff.top + (aElemOff.height / 2);
	let oMidElem = document.createElement("DIV");
	oMidElem.style.width = "5px";
	oMidElem.style.height = "5px";
	oMidElem.style.position = "fixed";
	oMidElem.style.top = iElemMidY + "px";
	oMidElem.style.left = iElemMidX + "px";
	oMidElem.style.zIndex = 25;
	oMidElem.style.background = sCol;
	document.body.appendChild(oMidElem);
};

PDFViewer.prototype.showPredictedMousePosition = function(e, oElem, offX, offY, sCol) {
	let aElemOff = oElem.getBoundingClientRect();
	let iElemMidX = aElemOff.left + (aElemOff.width / 2);
	let iElemMidY = aElemOff.top + (aElemOff.height / 2);
	let oMidElem = document.createElement("DIV");
	oMidElem.style.width = "5px";
	oMidElem.style.height = "5px";
	oMidElem.style.position = "fixed";
	oMidElem.style.top = (iElemMidY + offY) + "px";
	oMidElem.style.left = (iElemMidX + offX) +"px";
	oMidElem.style.zIndex = 25;
	oMidElem.style.background = sCol;
	document.body.appendChild(oMidElem);
};

PDFViewer.prototype.showPredictedMidPoint = function(e, oElem, offX, offY, sCol) {
	let aElemOff = oElem.getBoundingClientRect();
	let iElemMidX = aElemOff.left + (aElemOff.width / 2);
	let iElemMidY = aElemOff.top + (aElemOff.height / 2);
	let oMidElem = document.createElement("DIV");
	oMidElem.style.width = "5px";
	oMidElem.style.height = "5px";
	oMidElem.style.position = "fixed";
	oMidElem.style.top = (iElemMidY - offY) + "px";
	oMidElem.style.left = (iElemMidX - offX) +"px";
	oMidElem.style.zIndex = 25;
	oMidElem.style.background = sCol;
	document.body.appendChild(oMidElem);
};
*/
PDFViewer.prototype.isInZoomMode = function() {
	return this.zoomMode;
};

PDFViewer.prototype.setPageTitle = function(sTitle) {
	let oTitle = document.getElementsByTagName("title")[0];
	this.clearElem(oTitle);
	oTitle.appendChild(document.createTextNode(sTitle));
};

PDFViewer.prototype.setPageIcon = function(sIcoLink) {
	if("" != sIcoLink) {
		let sURL = this.sDocBaseURL + sIcoLink.substr(3);
		document.getElementById("pdf-ico").href = sURL;
	}
};

PDFViewer.prototype.updatePageCount = function() {
	let oPageDuplet = this.pageDuplets[this.posDupletArray];
	let oPageViewer = document.getElementById("pdf-current-site");
	if(null == oPageDuplet[0]) {
		oPageViewer.placeholder = "" + oPageDuplet[1] + "/" + this.pdfDoc.numPages;
	} else if(null == oPageDuplet[1]) {
		oPageViewer.placeholder = "" + oPageDuplet[0] + "/" + this.pdfDoc.numPages;
	} else {
		oPageViewer.placeholder = oPageDuplet[0] + "-" + oPageDuplet[1] + "/" + this.pdfDoc.numPages;
	}
};

PDFViewer.prototype.containsSearchString = function(oItem) {
	if(oItem.UID == this.sSearchUID) return true;
	return false;
};

PDFViewer.prototype.containsPageNumber = function(oItem) {
	return (oItem[0] == this.pageNumber || oItem[1] == this.pageNumber);
};

PDFViewer.prototype.containsSearchTerm = function(oItem) {
	if(oItem.str == this.sSearchTerm) return true;
	return false;
};

PDFViewer.prototype.getNextPages = function() {
	if(this.posDupletArray == (this.pageDuplets.length - 1)) return;
	this.posDupletArray++;
	this.queueRenderPages(this.posDupletArray);
};

PDFViewer.prototype.getPrevPages = function() {
	if(this.posDupletArray == 0) return;
	this.posDupletArray--;
	this.queueRenderPages(this.posDupletArray);
};

PDFViewer.prototype.getFirstPages = function() {
	this.posDupletArray = 0;
	this.queueRenderPages(this.posDupletArray);
};

PDFViewer.prototype.getLastPages = function() {
	this.posDupletArray = (this.pageDuplets.length - 1);
	this.queueRenderPages(this.posDupletArray);
};

PDFViewer.prototype.searchController = function(e) {
	if("Enter" == e.key) {
		let sSearchTerm = document.getElementById("pdf-search").value;
		this.searchFor(sSearchTerm);
	}
};

PDFViewer.prototype.dragElement = function(oElem) {
	let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
	if(document.getElementById(oElem.id + "-title")) {
		document.getElementById(oElem.id + "-title").onmousedown = dragMouseDown;
	} else {
		oElem.onmousedown = dragMouseDown;
	}
	
	function dragMouseDown(e) {
		e = e || window.event;
		e.preventDefault();
		pos3 = e.clientX;
		pos4 = e.clientY;
		document.onmouseup = closeDragElement;
		document.onmousemove = elementDrag;
	}
	
	function elementDrag(e) {
		e = e || window.event;
		e.preventDefault();
		pos1 = pos3 - e.clientX;
		pos2 = pos4 - e.clientY;
		pos3 = e.clientX;
		pos4 = e.clientY;
		oElem.style.top = (oElem.offsetTop - pos2) + "px";
		oElem.style.left = (oElem.offsetLeft - pos1) + "px";
	}
	
	function closeDragElement() {
		document.onmouseup = null;
		document.onmousemove = null;
	}
};

const PV = new PDFViewer();