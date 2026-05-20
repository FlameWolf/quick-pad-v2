import { render } from "solid-js/web";
import { Router } from "@solidjs/router";
import App from "./App";
import { Routes } from "./router";
import { registerServiceWorker } from "./registerServiceWorker";
import "./styles.css";

render(
	() => (
		<Router root={App}>
			{Routes()}
		</Router>
	),
	document.getElementById("app")!
);

registerServiceWorker();