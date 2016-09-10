json.array!(@data) do |datum|
  json.extract! datum, :id, :Name, :x, :y
  json.url datum_url(datum, format: :json)
end
