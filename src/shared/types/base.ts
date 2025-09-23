export default interface BaseData {
  id: string;
  createdAt: string;
  updatedAt: string;
}

export const serializeNestedBaseObject = (obj: any): any => {
  if (obj instanceof Array) {
    return obj.map((o) => serializeNestedBaseObject(o));
  } else if (obj instanceof Object) {
    const newObj: any = {};

    Object.keys(obj).forEach((key) => {
      if (
        (obj as any)[key] instanceof Object ||
        (obj as any)[key] instanceof Array
      ) {
        newObj[key] = serializeNestedBaseObject((obj as any)[key]);
        return;
      }

      if (
        typeof (obj as any)[key] === "string" &&
        ((obj as any)[key] as string).match(
          /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?(?:Z|([+-]\d{2}:\d{2}))?/
        )
      ) {
        newObj[key] = new Date((obj as any)[key]);
        return;
      }

      newObj[key] = (obj as any)[key];
    });

    if ((obj as any).external_id) {
      newObj.id = (obj as any).external_id;
    }

    return newObj;
  } else {
    return Object.assign({}, obj);
  }
};
