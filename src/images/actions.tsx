import * as Axios from "axios";
import { Thunk } from "../redux/interfaces";
import { API } from "../api";
import { success, error } from "../ui";
import { t } from "i18next";
import { Progress, ProgressCallback } from "../util";
import { GenericPointer } from "../interfaces";
import { Pair } from "farmbot/dist";
import { devices } from "../device";
const QUERY = { meta: { created_by: "plant-detection" } };

export function selectImage(uuid: string | undefined) {
  return { type: "SELECT_IMAGE", payload: uuid };
}

export function resetWeedDetection(cb: ProgressCallback): Thunk {
  return async function (dispatch, getState) {
    const URL = API.current.pointSearchPath;
    try {
      let { data } = await Axios.post<GenericPointer[]>(URL, QUERY);
      let ids = data.map(x => x.id);
      // If you delete too many points, you will violate the URL length
      // limitation of 2,083. Chunking helps fix that.
      let chunks = _.chunk(ids, 179 /* Prime numbers, why not? */);
      let prog = new Progress(chunks.length, cb);
      prog.inc();
      let promises = chunks.map(function (chunk) {
        return Axios
          .delete(API.current.pointsPath + chunk.join(","))
          .then(function (x) {
            prog.inc();
            return x;
          });
      });
      Promise
        .all(promises)
        .then(function () {
          dispatch({
            type: "DELETE_POINT_OK",
            payload: ids
          });
          success(t("Deleted {{num}} weeds", { num: ids.length }));
          prog.finish();
        })
        .catch(function (e) {
          error(t("Some weeds failed to delete. Please try again."));
          prog.finish();
        });
    } catch (e) {
      throw e;
    }
  };
};

export function detectWeeds(settings: object) {
  let pairs = Object
    .keys(settings)
    .map<Pair>(function (value: string, index) {
      let label = JSON.stringify(_.get(settings, value, "null"));
      return { kind: "pair", args: { value, label } };
    });
  return devices.current.execScript("plant-detection", pairs);
}
