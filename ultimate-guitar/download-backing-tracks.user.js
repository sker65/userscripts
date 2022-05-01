// ==UserScript==
// @name         Download backing tracks von ultimate-guitar.com
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  Easier downloading of backing tracks
// @author       Stefan Rinke
// @match        https://www.ultimate-guitar.com/backing_track/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=ultimate-guitar.com
// @grant        GM_download
// @grant        GM_addStyle
// ==/UserScript==

(function() {
  'use strict';

  GM_addStyle('span.btn-down:before { content: "D"; visibility: visible; display: inline-block; font-weight: 600; font-size: 13px; text-transform: uppercase; color: #212121;} span.btn-down { visibility: hidden; width: 20px; display: inline-block;');

  const trackURLS = [];
  const tracks = {};

      // hook into AJAX reqeusts to capture loaded calendar items
  (function(open) {
      XMLHttpRequest.prototype.open = function() {
          this.addEventListener("readystatechange", function() {
              if( this.readyState == 4 ){
                  const respURL = this.responseURL.toString();
                  if( respURL.startsWith('https://www.ultimate-guitar.com/static/backingtracks/multitracks/normal/') ) {
                      console.log(respURL);
                      trackURLS.push(respURL);
                  }
              }
          }, false);
          open.apply(this, arguments);
      };
  })(XMLHttpRequest.prototype.open);


  const elementHandlers = {}; // name -> (node)=>{}

  elementHandlers.HEADER = (node) => {
      if( node.parentNode.classList.contains('controls' ) ) {
          console.log('Header', node.innerHTML);
          let fname = node.innerHTML.replaceAll(' ', '-' ) + ".mp3";
          let url = trackURLS.shift();
          tracks[fname] = url;
          let span = document.createElement('span');
          span.innerHTML = 'Down';
          span.className = "btn btn-default btn-xs btn-down";
          span.addEventListener("click", e=>{
              console.log(tracks[fname]);
              console.log("will download "+tracks[fname]+ " as "+ fname);
              GM_download({url: tracks[fname], saveAs: true, name: fname});
          });
          node.nextSibling.appendChild(span);
          node.nextSibling.nextSibling.style.width = '100px';
      }
  };

  function processNode( node ) {
      if( elementHandlers[node.nodeName] ) elementHandlers[node.nodeName](node);

      if( node.children ) {
          for (let i = 0; i < node.children.length; i++) {
              let item = node.children[i];
              processNode( item );
          }
      }
  }

  function mutationHandler (mutationRecords) {

      mutationRecords.forEach ( (mutation) => {
          //console.log( typeof mutation.target, mutation.target );
          if( mutation.target.classList.contains('playlist-tracks' )
             && mutation.type == "childList"
             && typeof mutation.addedNodes == "object"
             && mutation.addedNodes.length
            ) {
              for (var J = 0, L = mutation.addedNodes.length; J < L; ++J) {
                  const node = mutation.addedNodes[J];
                  processNode(node);
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