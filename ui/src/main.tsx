import { render } from "preact";
import { App } from "./App";
import { applyTheme, readTheme } from "./lib/theme";
import "./styles.css";

applyTheme(readTheme());
render(<App />, document.getElementById("app")!);
