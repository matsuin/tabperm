// background.js
//
//

'use strict';

(function() {
  const CSP = "Content-Security-Policy";
  const CSPO = "Content-Security-Policy-Original";
  const PERMS = "Perms";

  var tabPerms = {};
  var extCSP = {};

  const PERMS_DEFAULT = "perms-default";
  var tabpermSettings = {
    [PERMS_DEFAULT]: 0x1f,
  };
  const SRC_PERMS = {
    "script": 0x01,
    "img": 0x02,
    "frame": 0x04,
    "media": 0x08,
    "object": 0x10,
  };
  const DEFAULT_PERMS = {
    "script-default": 0x0100,
    "img-default": 0x0200,
    "frame-default": 0x0400,
    "media-default": 0x0800,
    "object-default": 0x1000,
  };

  const CSP_EXTENSIONS = [
    "uMatrix@raymondhill.net.hotmint.com",
  ];

  var dbg = console.log;

  //
  dbg("background:");
  browser.storage.local.get(tabpermSettings).then((v) => {
    dbg("background: items=" + JSON.stringify(v));
    tabpermSettings = v;
    browser.storage.local.set(tabpermSettings);
  });

  //
  function getIndex(headers, name) {
    var i = headers.length;
    while (i--) {
      if (headers[i].name.toLowerCase() === name.toLowerCase()) {
        return i;
      }
    }
    return -1;
  };

  //
  function setIcon(tabid) {
    if (!tabPerms.hasOwnProperty(tabid)) {
      tabPerms[tabid] = tabpermSettings[PERMS_DEFAULT];
      browser.sessions.setTabValue(tabid, PERMS, tabPerms[tabid]);
    }
    var perms = tabPerms[tabid];
    dbg("setIcon: perms=" + perms);

    var icon = {
      path: "icons/"+perms+".svg",
    }
    dbg("setIcon: icon=" + icon);
    browser.browserAction.setIcon(icon);
  };
  
  //
  function onBeforeSendHeaders(details) {
    var tabid = details.tabId;
    var requestid = details.requestId;
    var headers = details.requestHeaders;

    dbg("================================");
    dbg("================================");
    dbg("onBeforeSendHeaders: tabid=" + tabid);
    dbg("onBeforeSendHeaders: requestId=" + requestid);
    dbg("onBeforeSendHeaders: url=" + details.url);
    dbg("onBeforeSendHeaders: headers="+headers.toSource());

    if (!tabPerms.hasOwnProperty(tabid)) {
      tabPerms[tabid] = tabpermSettings[PERMS_DEFAULT];
      browser.sessions.setTabValue(tabid, PERMS, tabPerms[tabid]);
    }
    var perms = tabPerms[tabid];

    var csp = [];

    for (const p in SRC_PERMS) {
      if (!(perms & SRC_PERMS[p])) {
        csp.push(p + "-src 'none'");
      }
    }
    if (csp.length !== 0) {
      var csps = csp.join(", ");
      for (const ext of CSP_EXTENSIONS) {
        dbg("onBeforeSendHeaders: ext="+ext);
        browser.runtime.sendMessage(ext, {
          name: 'csp',
          value: csps,
          requestid: requestid,
        });
      }
    }
  };
  browser.webRequest.onBeforeSendHeaders.addListener(
    onBeforeSendHeaders,
    {
      urls: ['<all_urls>'],
      types: ['main_frame', 'sub_frame']
    },
    ['blocking', 'requestHeaders']
  );

  //
  function onHeadersReceived(details) {
    return new Promise((resolve) => {
      var tabid = details.tabId;
      var requestid = details.requestId;
      var headers = details.responseHeaders;

      dbg("================================");
      dbg("onHeadersReceived: tabid=" + tabid);
      dbg("onHeadersReceived: requestId=" + requestid);
      dbg("onHeadersReceived: url=" + details.url);
      dbg("onHeadersReceived: headers=" + headers.toSource());

      //
      if (!tabPerms.hasOwnProperty(tabid)) {
        tabPerms[tabid] = tabpermSettings[PERMS_DEFAULT];
        browser.sessions.setTabValue(tabid, PERMS, tabPerms[tabid]);
      }
      var perms = tabPerms[tabid];
      dbg("onHeadersReceived: perms=" + perms);

      var i = getIndex(headers, "content-type");
      if (i < 0) {
        dbg("onHeadersReceived: ignore");
        resolve({responseHeaders: headers});
        return;
      }

      var csp = [];
      var cspo = ",";

      // only
      var i = getIndex(headers, CSP);
      if (i >= 0) {
        dbg("onHeadersReceived: CSP old='" + headers[i].value + "'");
        var j = getIndex(headers, CSPO);
        if (j >= 0) {
          dbg("onHeadersReceived: CSPO old='" + headers[j].value + "'");
          cspo = headers[j].value;
          if (cspo != ",") {
            csp.push(cspo);
          }
          headers.splice(i, 1);
          headers.splice(j, 1);
        } else {
          cspo = headers[i].value;
        }
      }

      dbg("onHeadersReceived: CSPO new='" + cspo + "'");
      headers.push({
        name: CSPO,
        value: cspo
      });

      if (extCSP.hasOwnProperty(requestid)) {
        csp.push(extCSP[requestid]);
      }

      for (const p in SRC_PERMS) {
        if (!(perms & SRC_PERMS[p])) {
          csp.push(p + "-src 'none'");
        }
      }
      var csps = csp.join(", ");
      dbg("onHeadersReceived: CSP new='" + csps + "'");
      headers.push({
        name: CSP,
        value: csps
      });

      dbg("onHeadersReceived: h2="+headers.toSource());
      resolve({responseHeaders: headers});
      return;
    });
  };
  browser.webRequest.onHeadersReceived.addListener(
    onHeadersReceived,
    {
      urls: ['<all_urls>'],
      types: ['main_frame', 'sub_frame']
    },
    ['blocking', 'responseHeaders']
  );

  //
  function onResponseStarted(details) {
    var tabid = details.tabId;
    var requestid = details.requestId;
    var headers = details.responseHeaders;

    dbg("--------------------------------");
    dbg("onResponseStarted: tabid=" + tabid);
    dbg("onResponseStarted: requestId=" + requestid);
    dbg("onResponseStarted: url=" + details.url);
    dbg("onResponseStarted: headers="+headers.toSource());
    dbg("onResponseStarted: fromCache=" + details.fromCache);

    delete extCSP[requestid];
  };
  browser.webRequest.onResponseStarted.addListener(
    onResponseStarted,
    {
      urls: ['<all_urls>'],
      types: ['main_frame', 'sub_frame']
    },
    ['responseHeaders']
  );

  //
  function onCreated(tab) {
    var tabid = tab.id;
    dbg("onCreated " + tabid);
    browser.sessions.getTabValue(tabid, PERMS).then((v) => {
      if (v !== undefined) {
        dbg("onCreated: tabid=" + tabid + " perms='" + v + "'");
        tabPerms[tabid] = v;
        setIcon(tabid);
      }
    });
  };
  browser.tabs.onCreated.addListener(onCreated);

  //
  function onRemoved(tabId, removeInfo) {
    var tabid = tabId;
    dbg("onRemoved " + tabid);
    delete tabPerms[tabid];
  }
  browser.tabs.onRemoved.addListener(onRemoved);

  //
  function onActivated(activeInfo) {
    var tabid = activeInfo.tabId;
    dbg("onActivated: tabid=" + tabid);
    setIcon(tabid);
  };
  browser.tabs.onActivated.addListener(onActivated);

  //
  function onMessage(message, sender, sendResponse) {
    var tabid = message.tabid;
    var command = message.command;
    var perm = message.perm;

    dbg("onMessage: tabid=" + tabid);
    dbg("onMessage: command=" + command);
    dbg("onMessage: perm=" + perm);

    if (command === "reload") {
      browser.tabs.reload(tabid, {bypassCache: false});
    } else if (command === "get") {
      if (!tabPerms.hasOwnProperty(tabid)) {
        tabPerms[tabid] = tabpermSettings[PERMS_DEFAULT];
        browser.sessions.setTabValue(tabid, PERMS, tabPerms[tabid]);
      }
      var perms = tabPerms[tabid] + (tabpermSettings[PERMS_DEFAULT] << 8);
      sendResponse({p: perms});
    } else if (command === "enable") {
      if (SRC_PERMS.hasOwnProperty(perm)) {
        tabPerms[tabid] |= SRC_PERMS[perm];
        setIcon(tabid);
        browser.sessions.setTabValue(tabid, PERMS, tabPerms[tabid]);
      } else {
        var p = perm.substr(0, perm.length - 8);
        tabpermSettings[PERMS_DEFAULT] |= SRC_PERMS[p];
        browser.storage.local.set(tabpermSettings);
      }
    } else if (command === "disable") {
      if (SRC_PERMS.hasOwnProperty(perm)) {
        tabPerms[tabid] &= ~SRC_PERMS[perm];
        setIcon(tabid);
        browser.sessions.setTabValue(tabid, PERMS, tabPerms[tabid]);
      } else {
        var p = perm.substr(0, perm.length - 8);
        tabpermSettings[PERMS_DEFAULT] &= ~SRC_PERMS[p];
        browser.storage.local.set(tabpermSettings);
      }
    }
  };
  browser.runtime.onMessage.addListener(onMessage);

  //
  function onMessageExternal(message, sender, sendResponse) {
    dbg("onMessageExternal: name=" + message.name);
    dbg("onMessageExternal: value=" + message.value);
    dbg("onMessageExternal: requestid=" + message.requestid);

    var requestid = message.requestid;
    if (extCSP.hasOwnProperty(requestid)) {
      extCSP[requestid] += ", " + message.value;
    } else {
      extCSP[requestid] = message.value;
    }
  };
  browser.runtime.onMessageExternal.addListener(onMessageExternal);

})();
