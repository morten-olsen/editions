import createClient from "openapi-fetch";

import type { paths } from "./api.types.ts";

const client = createClient<paths>();

export { client };
