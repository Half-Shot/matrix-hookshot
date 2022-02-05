import { h } from "preact";
import { useState } from 'preact/hooks';
import { Button } from "../Button";

export default function GeneralConfig() {
    return <div>
        <h2>GitHub</h2>
        <hr/>
        <section>
            <h3> Filters </h3>
            <p> You have no configured filters. </p>
            <Button> Add Filter </Button>
        </section>
    </div>;
}