import {ancestorsOf, classOf, nameOf} from "@tsed/core";
import {BaseContext, DIContext, Inject, Injectable, InjectorService} from "@tsed/di";
import {ErrorFilter} from "../components/ErrorFilter";
import {ExceptionFilter} from "../components/ExceptionFilter";
import {MongooseErrorFilter} from "../components/MongooseErrorFilter";
import {StringErrorFilter} from "../components/StringErrorFilter";
import {ExceptionFilterKey, ExceptionFiltersContainer} from "../domain/ExceptionFiltersContainer";
import {ResourceNotFound} from "../errors/ResourceNotFound";
import {ExceptionFilterMethods} from "../interfaces/ExceptionFilterMethods";

/**
 * Catch all errors and return the json error with the right status code when it's possible.
 *
 * @platform
 */
@Injectable({
  imports: [ErrorFilter, ExceptionFilter, MongooseErrorFilter, StringErrorFilter]
})
export class PlatformExceptions {
  types: Map<ExceptionFilterKey, ExceptionFilterMethods> = new Map();

  @Inject()
  injector: InjectorService;

  $onInit() {
    ExceptionFiltersContainer.forEach((token, type) => {
      this.types.set(type, this.injector.get(token)!);
    });
  }

  catch(error: unknown, ctx: DIContext) {
    const name = nameOf(classOf(error));

    if (name && this.types.has(name)) {
      return this.types.get(name)!.catch(error, ctx);
    }

    const target = ancestorsOf(error)
      .reverse()
      .find((target) => this.types.has(target));

    if (target) {
      return this.types.get(target)!.catch(error, ctx);
    }

    // default
    return this.types.get(Error)!.catch(error, ctx);
  }

  resourceNotFound(ctx: DIContext) {
    return this.catch(new ResourceNotFound(ctx.request.url), ctx);
  }
}
