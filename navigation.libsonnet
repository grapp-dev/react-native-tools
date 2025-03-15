{
  Navigator(name, data)::
    if std.isString(data) then
      {
        _tag: 'Navigator',
        name: name,
        path: data,
        children: [],
      }
    else if std.isObject(data) then
      {
        _tag: 'Navigator',
        name: name,
        children+: [],
      } + data
    else
      {},
  Screen(name, options = {}):: 
    {
      _tag: 'Screen',
      name: name,
    } + options,
  Group(name, data):: 
    {
      _tag: 'Group',
      name: name,
      children+: [],
    } + data,
  Expression(value, options = {})::
    {
      _tag: 'Expression',
      value: value,
    } + options,
}
