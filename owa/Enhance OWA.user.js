// ==UserScript==
// @name         Enhance OWA
// @namespace    https://github.com/sker65/userscripts/tree/main/owa
// @version      0.10
// @updateURL    https://github.com/sker65/userscripts/raw/main/owa/Enhance%20OWA.user.js
// @description  Enhances calendar item preview to create clickable google meet links, clickable localtions (if a url is given), add google meet as location with one click
// @author       Stefan Rinke
// @match        https://owa.understand.ai:*/owa/*
// @icon         https://understand.ai/assets/favicon/apple-icon-57x57.png
// @grant        GM_registerMenuCommand
// @grant        GM_setValue
// @grant        GM_getValue
// ==/UserScript==

(function() {
    'use strict';

    const icons = {
        meet: 'https://cdn.icon-icons.com/icons2/2642/PNG/32/google_meet_camera_logo_icon_159349.png',
        mail: 'https://cdn.icon-icons.com/icons2/294/PNG/256/Mail_31108.png',
        cal: 'https://cdn.icon-icons.com/icons2/1011/PNG/512/Google_Calendar_icon-icons.com_75710.png'
    };

    const NotifyType = { CAL: 1, MAIL: 0};

    function configureLink() {
        let link = GM_getValue( 'myMeetingLink', '');
        console.log("configuring Link");
        let newLink = prompt("Please enter your meet url", link ? link : 'https://meet.google.com/');
        if( newLink && newLink !== link ) {
            GM_setValue('myMeetingLink', newLink );
        }
        return newLink;
    }

    function configureNotify() {
        let desktopNotifyActive = confirm('Would you like to activate desktop notifications?');
        if( desktopNotifyActive ) {
            Notification.requestPermission();
        }
        GM_setValue('desktopNotifyActive', desktopNotifyActive );
        return desktopNotifyActive;
    }

    GM_registerMenuCommand("Configure Meet URL", configureLink);
    GM_registerMenuCommand("Configure Desktop Notifications", configureNotify);

    var lastLoadedCalItem = null;
    let networkErrorCount = 0;

    function handleError(err) {
        networkErrorCount = networkErrorCount + 1;
        console.error("XHR ERROR: ", err.type, networkErrorCount );
        if( networkErrorCount > 4 ) {
            window.alert('Network problems, check your connection and maybe reload');
        }
    }

    // hook into AJAX reqeusts to capture loaded calendar items
    (function(open) {
        XMLHttpRequest.prototype.open = function() {
            this.addEventListener("error", (err) => {
                handleError(err);
            } );
            this.addEventListener("timeout", (err) => {
                handleError(err);
            } );
            this.addEventListener("abort", (err) => {
                handleError(err);
            } );
            this.addEventListener("readystatechange", function() {
                if( this.readyState == 4 ){
                    const respURL = this.responseURL.toString();
                    networkErrorCount=0;
                    //console.log(typeof this.response);
                    if( respURL.includes("action=GetCalendarEvent") ) {
                        //console.log( this.response );
                        let r = null;
                        try {
                            r = JSON.parse(this.response);
                        }catch(e) {
                            console.error("error parsing JSON response for calItem",e);
                        }
                        const resItem = r.Body?.ResponseMessages?.Items[0];
                        if( resItem.ResponseClass === "Success" ) {
                            const calItem = resItem.Items[0];
                            //console.log(calItem.Body.Value );
                            lastLoadedCalItem = calItem;
                            //console.log("lastLoadedCalItem SET to ", calItem.Body.Value.substr(0,30));
                            updatePreviewLocation(calItem);
                        }
                    }
                }
            }, false);
            open.apply(this, arguments);
        };
    })(XMLHttpRequest.prototype.open);

    var locationElement = null;

    function isValidHttpUrl(string) {
        let url;
        try {
            url = new URL(string);
        } catch (_) {
            return false;
        }
        return url.protocol === "http:" || url.protocol === "https:";
    }

    function updatePreviewLocation( item /*calendarItem*/ ) {
        const body = item.Body.Value;;
        let realLocation = item.Location?.DisplayName;
        // make "URL locations" clickable in general -> team does not create a location property
        if( isValidHttpUrl(realLocation) ) {
            realLocation = `<a target="_blank" href="${realLocation}">${realLocation}</a>`;
        } else if( realLocation.startsWith('meet.google.com') && isValidHttpUrl(`https://${realLocation}`) ) {
            realLocation = `<a target="_blank" href="https://${realLocation}">${realLocation}</a>`;
        }

        let linkIds = body.match(/(https:\/\/meet.google.com\/[a-z][a-z][a-z]-[a-z][a-z][a-z][a-z]-[a-z][a-z][a-z])/g);
        const teamsRefEx = /"(?<link>https:\/\/teams.microsoft.com\/l\/meetup-join\/.*)"/g;
        let teamLinkIds = teamsRefEx.exec(body);
        console.log( teamLinkIds, linkIds, locationElement );
        if( locationElement ) {
            if( teamLinkIds && teamLinkIds.groups.link) {
                const link = teamLinkIds.groups.link;
                const template = `<div> <span class="ms-font-s ms-font-weight-regular" title="MS Teams Meeting" style=""><span class="bidi">${realLocation}${realLocation.length>0?'<br/>':''}<a target="_blank" href="${link}">MS Teams Meeting</a></span></span> </div>`;
                locationElement.innerHTML = template;
            } else if( linkIds && linkIds.length >0) {
                if( realLocation.includes('https://meet.google.com') ) {
                    realLocation = ""; // avoid double meet URL
                }
                const link= linkIds[0];
                const template = `<div> <span class="ms-font-s ms-font-weight-regular" title="${link}" style=""><span class="bidi">${realLocation}${realLocation.length>0?'<br/>':''}<a target="_blank" href="${link}">${link}</a></span></span> </div>`;
                locationElement.innerHTML = template;
            } else {
                const template = `<div> <span class="ms-font-s ms-font-weight-regular" style="">${realLocation}<span class="bidi"></span></span> </div>`;
                locationElement.innerHTML = template;
            }
        }
    }

    function buildMeetButton() {
        let but = document.createElement("button");
        but.innerHTML = `<img width="32" height="32" src="${icons.meet}"/>`;
        but.id = "addMeeting";
        but.style.width = "32px";
        but.style.height = "32px";
        but.style.marginLeft = '2px';
        but.style["border-style"] = 'none';
        but.style["background-color"] = 'white';
        return but;
    }

    function buildNotification(node, type) {
        let title = '';
        let body = '';
        if( type === NotifyType.CAL ) {
            let rows = node.querySelectorAll('.o365cs-w100-h100');
            title = rows[0].innerText;
            body = rows[1].innerText;
        } else if( type === NotifyType.MAIL ) {
            title = node.querySelector('.o365cs-notifications-newMailPopupButtonContent').innerText;
            let rows = node.querySelectorAll('.o365cs-notifications-text');
            for( let i = 1; i < rows.length; i++ ) {
                body += rows[i].innerText + ' ';
            }
        }
        return {
            title,
            body,
            icon: type === NotifyType.CAL ? icons.cal : icons.mail
        };
    }

    const elementHandlers = {}; // name -> (node)=>{}

    elementHandlers.DIV = (node) => {
        if( node.className === '_ck_6' && node.getAttribute('aria-label') == 'Location') {
            locationElement = node;
            //console.log("location node found");
        }
        if( node.classList.contains('o365cs-notifications-reminders-container') || node.classList.contains('o365cs-notifications-newMailPopupButton' ) ) {
            if( Notification.permission === "granted" && GM_getValue('desktopNotifyActive')) {
                // extract title, body & type (mail / caledar)
                let type = node.classList.contains('o365cs-notifications-newMailPopupButton' ) ? NotifyType.MAIL : NotifyType.CAL
                let nc = buildNotification(node, type);
                let notify = new Notification( nc.title, {
                    body: nc.body,
                    icon: nc.icon
                } );
            }
        }
    };

    elementHandlers.SPAN = (node) => {
        if( node.className === 'bidi' ) {
            //locationnode = node;
            //console.log(node.innerHTML);
            // make room display in preview a clickable link
            if( node.innerHTML && node.innerHTML.startsWith("https://meet.google.com") ) {
                const link = node.innerHTML;
                node.innerHTML = `<a target="_meet" href="${link}">${link}</a>`;
            }
        }
        //console.log("SPAN class=", node.className  );
        if( node.classList.contains('bodySelector') ) {
            //console.log(node.innerHTML);
            if( lastLoadedCalItem ) updatePreviewLocation(lastLoadedCalItem);
        }
        if( node.classList.contains('o365cs-notifications-reminders-location')) {
            if( isValidHttpUrl(node.innerHTML) ) {
                const url = node.innerHTML;
                node.innerHTML = `<a target="_meet" href="${url}">${url}</a>`;
            }
        }
    };

    elementHandlers.INPUT = (node) => {
        if( node.getAttribute('autoid') == "_lw_0" // look for autoid instead
           /*&& node.getAttribute("aria-labelledby") == "MeetingCompose.LocationInputLabel"*/ ) {
            //console.log("INPUT FORM found");
            if( node.nextSibling && node.nextSibling.id != "addMeeting" ) {
                node.style.width = `${node.offsetWidth-36}px`;
                let but = buildMeetButton();
                but.addEventListener("click", e=>{
                    node.focus();
                    let link = GM_getValue( 'myMeetingLink', '');
                    if(!link) link = configureLink();
                    node.value = link;
                    node.dispatchEvent(new Event('change'));
                });
                // insert after
                node.parentNode.insertBefore(but, node.nextSibling);
            }
        }
    }

    function checkNode( node ) {
        if( elementHandlers[node.nodeName] ) elementHandlers[node.nodeName](node);

        if( node.children ) {
            for (let i = 0; i < node.children.length; i++) {
                let item = node.children[i];
                checkNode( item );
            }
        }
    }

    function mutationHandler (mutationRecords) {

        mutationRecords.forEach ( (mutation) => {

            if(mutation.type == "childList"
               && typeof mutation.addedNodes == "object"
               && mutation.addedNodes.length
              ) {
                for (var J = 0, L = mutation.addedNodes.length; J < L; ++J) {
                    const node = mutation.addedNodes[J];
                    checkNode(node);
                }
            } else if (mutation.type == "attributes") {
                // not used actually
                const src = mutation.target.getAttribute('src');
                //console.log("changed Attribute node: "+mutation.target.nodeName+" src="+ src );
            }
        } );
    }

    var MutationObserver = window.MutationObserver;
    var observer = new MutationObserver(mutationHandler);
    var observerConfig = {
        childList: true, attributes: true,
        subtree: true, attributeFilter: ['src']
    };

    observer.observe (document, observerConfig);

})();