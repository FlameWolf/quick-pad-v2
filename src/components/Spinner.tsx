import { Show, mergeProps } from "solid-js";
import { Dynamic } from "solid-js/web";

type Props = {
	message?: string;
	minimal?: boolean;
	showMessage?: boolean;
	tag?: string;
};

export default function Spinner(rawProps: Props) {
	const props = mergeProps({ showMessage: true }, rawProps);

	return (
		<Show when={!props.minimal} fallback={<Dynamic component={props.tag ?? "div"} class="spinner-border spinner-border-sm" role="status"/>}>
			<div class="d-flex flex-column justify-content-center align-items-center" classList={{ "py-3": !props.showMessage }}>
				<div class="spinner-border" aria-hidden="true" aria-label={props.showMessage ? undefined : props.message}/>
				<Show when={props.showMessage}>
					<div class="mt-3" role="status">{props.message ?? "Loading..."}</div>
				</Show>
			</div>
		</Show>
	);
}