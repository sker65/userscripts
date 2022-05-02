// ==UserScript==
// @name         Download backing tracks von ultimate-guitar.com
// @namespace    https://github.com/sker65/userscripts/ultimate-guitar
// @run-at       document-start
// @version      0.2
// @description  Easier downloading of backing tracks
// @updateURL    https://github.com/sker65/userscripts/raw/main/ultimate-guitar/download-backing-tracks.user.js
// @downloadURL  https://github.com/sker65/userscripts/raw/main/ultimate-guitar/download-backing-tracks.user.js
// @author       Stefan Rinke
// @match        https://www.ultimate-guitar.com/backing_track/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=ultimate-guitar.com
// @grant        GM_download
// @grant        GM_addStyle
// ==/UserScript==

(function() {
  'use strict';

  GM_addStyle('span.btn-down:before { content: "D"; visibility: visible; display: inline-block; font-weight: 600; font-size: 13px; text-transform: uppercase; color: #212121;} span.btn-down { visibility: hidden; width: 20px; display: inline-block;');

  let config = null;
  const elementHandlers = {}; // name -> (node)=>{}

  elementHandlers.HEADER = (node, remove) => {
      if( node.parentNode.classList.contains('controls' ) ) {
          //console.log('Header', node.innerHTML);
          let name = node.innerHTML;
          let fname = node.innerHTML.replaceAll(' ', '-' ) + ".mp3";
          let span = document.createElement('span');
          span.innerHTML = 'Down';
          span.className = "btn btn-default btn-xs btn-down";
          span.addEventListener("click", e=>{
              //console.log(name);
              const i = config.find( r => r.name == name );
              if( i ) {
                  //console.log(i);
                  console.log("will download '"+name+ "' as "+ fname + " from "+i.content_urls.normal);
                  GM_download({url: i.content_urls.normal, saveAs: true, name: fname});
              } else {
                  console.warn("download item not found");
              }
          });
          node.nextSibling.appendChild(span);
          node.nextSibling.nextSibling.style.width = '100px';
      }
  };

  elementHandlers.DIV = (node, remove) => {
      const escData = node.getAttribute('data-content');
      if( escData ) {
          const data = escData.replace(/&quot;/g, '"');
          const conf = JSON.parse(data);
          // json path store.page.data.viewer.backing_track.content_urls
          //console.log("CONFIG (DIV handler)", remove, conf.store.page.data.viewer.backing_track.content_urls);
          config = conf.store.page.data.viewer.backing_track.content_urls;
      }
  }

  function processNode( node, remove ) {
      if( elementHandlers[node.nodeName] ) elementHandlers[node.nodeName](node, remove);

      if( node.children ) {
          for (let i = 0; i < node.children.length; i++) {
              let item = node.children[i];
              processNode( item, remove );
          }
      }
  }

  function mutationHandler (mutationRecords) {

      mutationRecords.forEach ( (mutation) => {
          // console.log( mutation.type, typeof mutation.target, mutation.target );
          if( /*mutation.target.classList.contains('playlist-tracks' )
             && */ mutation.type == "childList"
             && typeof mutation.addedNodes == "object"
             && mutation.addedNodes.length
            ) {
              for (var J = 0, L = mutation.addedNodes.length; J < L; ++J) {
                  const node = mutation.addedNodes[J];
                  processNode(node, false);
              }
          } else if( /*mutation.target.classList.contains('playlist-tracks' )
             && */ mutation.type == "childList"
             && typeof mutation.removedNodes == "object"
             && mutation.removedNodes.length
            ) {
              for (var J1 = 0, L1 = mutation.removedNodes.length; J1 < L1; ++J1) {
                  const node = mutation.removedNodes[J1];
                  processNode(node, true);
              }
          }
      } );
  }

  var MutationObserver = window.MutationObserver;
  var observer = new MutationObserver(mutationHandler);
  var observerConfig = {
      childList: true, attributes: true,
      subtree: true
  };

  observer.observe (document, observerConfig);
})();