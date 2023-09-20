import {cleanObject, getValue} from "@tsed/core";
import {OperationVerbs} from "../../constants/OperationVerbs";
import {JsonMethodStore} from "../../domain/JsonMethodStore";
import {JsonMethodPath} from "../../domain/JsonOperation";
import {SpecTypes} from "../../domain/SpecTypes";
import {JsonSchemaOptions} from "../../interfaces/JsonSchemaOptions";
import {execMapper, registerJsonSchemaMapper} from "../../registries/JsonSchemaMapperContainer";
import {makeOf} from "../../utils/somethingOf";

export function messageMapper(
  jsonOperationStore: JsonMethodStore,
  operationPath: JsonMethodPath,
  {tags = [], defaultTags = [], ...options}: JsonSchemaOptions = {}
) {
  const {path: event, method} = operationPath;

  const messageKey = String(event);

  let message: any = getValue(
    options.components,
    "messages." + event,
    cleanObject({
      description: jsonOperationStore.operation.get("description"),
      summary: jsonOperationStore.operation.get("summary")
    })
  );

  if (method.toUpperCase() === OperationVerbs.PUBLISH) {
    const payload = execMapper("payload", [jsonOperationStore, operationPath], options);

    if (payload) {
      message.payload = payload;
    }

    const responses = jsonOperationStore.operation
      .getAllowedOperationPath([OperationVerbs.SUBSCRIBE])
      .map((operationPath) => {
        return execMapper("message", [jsonOperationStore, operationPath], options);
      })
      .filter(Boolean);

    const responsesSchema = makeOf("oneOf", responses);

    if (responsesSchema) {
      message["x-response"] = responsesSchema;
    }
  } else {
    const response = execMapper("response", [jsonOperationStore, operationPath], options);

    if (response) {
      message["x-response"] = response;
    }
  }

  options.components!.messages = options.components!.messages || {};
  options.components!.messages[messageKey] = message;

  return {$ref: `#/components/messages/${messageKey}`};
}

registerJsonSchemaMapper("message", messageMapper, SpecTypes.ASYNCAPI);
