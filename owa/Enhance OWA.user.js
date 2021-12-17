// ==UserScript==
// @name         Enhance OWA
// @namespace    https://github.com/sker65/userscripts/tree/main/owa
// @version      0.7
// @updateURL    https://github.com/sker65/userscripts/raw/main/owa/Enhance%20OWA.user.js
// @description  Enhances calendar item preview to create clickable google meet links, clickable localtions (if a url is given), add google meet as location with one click
// @author       Stefan Rinke
// @match        https://owa.understand.ai:*/owa/*
// @icon         https://www.google.com/s2/favicons?domain=understand.ai
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
    GM_registerMenuCommand("Configure Desktop Nofications", configureNotify);

    var lastLoadedCalItem = null;

    // hook into AJAX reqeusts to capture loaded calendar items
    (function(open) {
        XMLHttpRequest.prototype.open = function() {
            this.addEventListener("readystatechange", function() {
                if( this.readyState == 4 ){
                    const respURL = this.responseURL.toString();
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
                            console.log("lastLoadedCalItem SET to ", calItem.Body.Value.substr(0,30));
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
        // make "URL locations" clickable in general
        if( isValidHttpUrl(realLocation) ) {
            realLocation = `<a target="_blank" href="${realLocation}">${realLocation}</a>`;
        }

        let linkIds = body.match(/(https:\/\/meet.google.com\/[a-z][a-z][a-z]-[a-z][a-z][a-z][a-z]-[a-z][a-z][a-z])/g);
        console.log( linkIds, locationElement );
        if( locationElement ) {
            if( linkIds && linkIds.length >0) {
                if( realLocation.includes('https://meet.google.com') ) {
                    realLocation = ""; // avoid double meet URL
                }
                const link= linkIds[0];
                const template = `<div> <span class="ms-font-s ms-font-weight-regular" title="${link}" style=""><span class="bidi">${realLocation}${realLocation.length>0?'<br/>':''}<a target="_meet" href="${link}">${link}</a></span></span> </div>`;
                locationElement.innerHTML = template;
            } else {
                const template = `<div> <span class="ms-font-s ms-font-weight-regular" style="">${realLocation}<span class="bidi"></span></span> </div>`;
                locationElement.innerHTML = template;
            }
        }
    }

    var MutationObserver = window.MutationObserver;
    var myObserver = new MutationObserver(mutationHandler);
    var obsConfig = {
        childList: true, attributes: true,
        subtree: true, attributeFilter: ['src']
    };

    myObserver.observe (document, obsConfig);

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

    function buildNotification(node) {
        let type = 1; // calendar for now
        let rows = node.querySelectorAll('.o365cs-w100-h100');
        let title = rows[0].innerText;
        let body = rows[1].innerText;
        return {
            title,
            body,
            icon: type ? icons.cal : icons.mail
        };
    }

    function checkNode( node ) {
        if( node.nodeName == 'DIV' ) {
            if( node.className === '_ck_6' && node.getAttribute('aria-label') == 'Location') {
                locationElement = node;
                //console.log("location node found");
            }
            if( node.classList.contains('o365cs-notifications-reminders-container') ) {
                if( Notification.permission === "granted" && GM_getValue('desktopNotifyActive')) {
                    // extract title, body & type (mail / caledar)
                    let nc = buildNotification(node);
                    let notify = new Notification( nc.title, {
                        body: nc.body,
                        icon: nc.icon
                    } );
                }
            }
        }
        if( node.nodeName == 'SPAN') {
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
        }
        if( node.nodeName == 'INPUT' && node.getAttribute('autoid') == "_lw_0" // look for autoid instead
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
        /*if( node.nodeName == 'IFRAME' || node.nodeName == 'IMG' ) {
            const src = node.getAttribute('src');
            console.log( "SRC="+src );
            if( src.startsWith('https://exchange.dspace.de' ) ) {
                const replacedSrc = 'https://owa.understand.ai:1443' + src.substr(26);
                console.log( 'replacing src for iframe setting to: ' + replacedSrc );
                node.setAttribute( 'src', replacedSrc );
            }
        }*/
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
                const src = mutation.target.getAttribute('src');
                console.log("changed Attribute node: "+mutation.target.nodeName+" src="+ src );
            }
        } );
    }

})();