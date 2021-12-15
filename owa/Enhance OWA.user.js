// ==UserScript==
// @name         Enhance OWA
// @namespace    http://tampermonkey.net/
// @version      0.1
// @updateURL    https://github.com/sker65/userscripts/raw/main/owa/Enhance%20OWA.user.js
// @description  Enhances calendar item preview to create clickable google meet links, clickable localtions (if a url is given), add google meet as location with one click
// @author       Stefan Rinke
// @match        https://owa.understand.ai:*/owa/
// @icon         https://www.google.com/s2/favicons?domain=understand.ai
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    var lastLoadedCalItem = null;

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

    // const tempalte = `<div class="_ck_6" aria-label="Location"><div> <span class="ms-font-s ms-font-weight-regular" title=""></span> </div><a class="ms-font-s ms-font-weight-regular o365button" role="link" ></a></div>`;
    function checkNode( element ) {
        if( element.nodeName == 'DIV' && element.className === '_ck_6' && element.getAttribute('aria-label') == 'Location') {
            locationElement = element;
            //console.log("location element found");
        }
        if( element.nodeName == 'SPAN') {
            if( element.className === 'bidi' ) {
                //locationElement = element;
                //console.log(element.innerHTML);
                // make room display in preview a clickable link
                if( element.innerHTML && element.innerHTML.startsWith("https://meet.google.com") ) {
                    const link = element.innerHTML;
                    element.innerHTML = `<a target="_meet" href="${link}">${link}</a>`;
                }
            }
            //console.log("SPAN class=", element.className  );
            if( element.classList.contains('bodySelector') ) {
                //console.log(element.innerHTML);
                if( lastLoadedCalItem ) updatePreviewLocation(lastLoadedCalItem);
            }
        }
        //console.log(element.nodeName,
        if( element.nodeName == 'INPUT' && element.getAttribute("aria-labelledby") == "MeetingCompose.LocationInputLabel" ) {
            //console.log("INPUT FORM found");
            if( element.nextSibling && element.nextSibling.id != "addMeeting" ) {
                let but = document.createElement("button");
                but.innerHTML = '<img src="https://cdn.icon-icons.com/icons2/2642/PNG/512/google_meet_camera_logo_icon_159349.png"/>';
                but.id = "addMeeting";
                but.style.width = "32px";
                but.style.height = "32px";
                but.style.marginLeft = '2px';
                but.style["border-style"] = 'none';
                but.style["background-color"] = 'white';

                but.addEventListener("click", e=>{
                    element.focus();
                    //var evt = new KeyboardEvent('keypress', { key: "a" });
                    //element.dispatchEvent(evt);
                    element.value = "https://meet.google.com/mcv-boxf-mdu";
                    element.dispatchEvent(new Event('change'));
                });
                // insert after
                element.parentNode.insertBefore(but, element.nextSibling);
            }
        }
        /*if( element.nodeName == 'IFRAME' || element.nodeName == 'IMG' ) {
            const src = element.getAttribute('src');
            console.log( "SRC="+src );
            if( src.startsWith('https://exchange.dspace.de' ) ) {
                const replacedSrc = 'https://owa.understand.ai:1443' + src.substr(26);
                console.log( 'replacing src for iframe setting to: ' + replacedSrc );
                element.setAttribute( 'src', replacedSrc );
            }
        }*/
        if( element.children ) {
            for (let i = 0; i < element.children.length; i++) {
                let item = element.children[i];
                checkNode( item );
            }
        }
    }

    function mutationHandler (mutationRecords) {

        mutationRecords.forEach ( function (mutation) {

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