// The journal code was written against global React, ReactDOM and htm (as loaded from a CDN).
// Bundle them and expose the same globals so it runs unchanged.
import React from 'react';
import * as ReactDOMClient from 'react-dom/client';
import htm from 'htm';

window.React = React;
window.ReactDOM = ReactDOMClient;
window.htm = htm;
