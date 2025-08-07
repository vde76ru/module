// frontend/src/pages/Settings/SalesChannels.jsx
import React, { useState, useEffect } from 'react';
import {
  Container,
  Paper,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  FormControlLabel,
  Chip,
  Box,
  Alert,
  Grid,
  Tooltip,
  Divider,
  FormHelperText
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Store as StoreIcon,
  Public as PublicIcon,
  ShoppingCart as ShoppingCartIcon,
  Schedule as ScheduleIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon
} from '@mui/icons-material';
import axios from 'utils/axios';
import { useSnackbar } from 'notistack';

const SalesChannels = () => {
  const [channels, setChannels] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [marketplaces, setMarketplaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedChannel, setSelectedChannel] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    type: 'marketplace',
    source_id: '',
    default_warehouse_id: '',
    is_active: true,
    auto_confirm_orders: false,
    procurement_schedule: {
      enabled: false,
      days: [],
      time: '09:00'
    }
  });
  const { enqueueSnackbar } = useSnackbar();

  const channelTypes = [
    { value: 'marketplace', label: 'Маркетплейс', icon: <ShoppingCartIcon /> },
    { value: 'website', label: 'Интернет-магазин', icon: <PublicIcon /> },
    { value: 'offline_store', label: 'Офлайн магазин', icon: <StoreIcon /> },
    { value: 'other', label: 'Другое', icon: <StoreIcon /> }
  ];

  const weekDays = [
    { value: 'monday', label: 'Пн' },
    { value: 'tuesday', label: 'Вт' },
    { value: 'wednesday', label: 'Ср' },
    { value: 'thursday', label: 'Чт' },
    { value: 'friday', label: 'Пт' },
    { value: 'saturday', label: 'Сб' },
    { value: 'sunday', label: 'Вс' }
  ];

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [channelsRes, warehousesRes, marketplacesRes] = await Promise.all([
        axios.get('/sales-channels'),
        axios.get('/warehouses'),
        axios.get('/marketplaces')
      ]);

      setChannels(channelsRes.data);
      setWarehouses(warehousesRes.data);
      setMarketplaces(marketplacesRes.data);
    } catch (error) {
      enqueueSnackbar('Ошибка загрузки данных', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (channel = null) => {
    if (channel) {
      setSelectedChannel(channel);
      setFormData({
        name: channel.name,
        type: channel.type,
        source_id: channel.source_id || '',
        default_warehouse_id: channel.default_warehouse_id || '',
        is_active: channel.is_active,
        auto_confirm_orders: channel.auto_confirm_orders || false,
        procurement_schedule: channel.procurement_schedule || {
          enabled: false,
          days: [],
          time: '09:00'
        }
      });
    } else {
      setSelectedChannel(null);
      setFormData({
        name: '',
        type: 'marketplace',
        source_id: '',
        default_warehouse_id: '',
        is_active: true,
        auto_confirm_orders: false,
        procurement_schedule: {
          enabled: false,
          days: [],
          time: '09:00'
        }
      });
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setSelectedChannel(null);
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleScheduleChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      procurement_schedule: {
        ...prev.procurement_schedule,
        [field]: value
      }
    }));
  };

  const handleDayToggle = (day) => {
    const currentDays = formData.procurement_schedule.days;
    const newDays = currentDays.includes(day)
      ? currentDays.filter(d => d !== day)
      : [...currentDays, day];

    handleScheduleChange('days', newDays);
  };

  const handleSubmit = async () => {
    try {
      if (!formData.name) {
        enqueueSnackbar('Введите название канала', { variant: 'warning' });
        return;
      }

      const dataToSend = {
        ...formData,
        source_id: formData.type === 'marketplace' ? formData.source_id : null
      };

      if (selectedChannel) {
        await axios.put(`/api/sales-channels/${selectedChannel.id}`, dataToSend);
        enqueueSnackbar('Канал продаж обновлен', { variant: 'success' });
      } else {
        await axios.post('/api/sales-channels', dataToSend);
        enqueueSnackbar('Канал продаж создан', { variant: 'success' });
      }

      handleCloseDialog();
      fetchData();
    } catch (error) {
      enqueueSnackbar(error.response?.data?.message || 'Ошибка сохранения', {
        variant: 'error'
      });
    }
  };

  const handleDelete = async () => {
    try {
      await axios.delete(`/api/sales-channels/${selectedChannel.id}`);
      enqueueSnackbar('Канал продаж удален', { variant: 'success' });
      setDeleteDialogOpen(false);
      setSelectedChannel(null);
      fetchData();
    } catch (error) {
      enqueueSnackbar(error.response?.data?.message || 'Ошибка удаления', {
        variant: 'error'
      });
    }
  };

  const getChannelIcon = (type) => {
    const channelType = channelTypes.find(ct => ct.value === type);
    return channelType ? channelType.icon : <StoreIcon />;
  };

  const getSourceName = (channel) => {
    if (channel.type === 'marketplace' && channel.source_id) {
      const marketplace = marketplaces.find(m => m.id === channel.source_id);
      return marketplace ? marketplace.name : 'Не указан';
    }
    return '-';
  };

  const getWarehouseName = (warehouseId) => {
    const warehouse = warehouses.find(w => w.id === warehouseId);
    return warehouse ? warehouse.name : 'Не указан';
  };

  const formatSchedule = (schedule) => {
    if (!schedule || !schedule.enabled) {
      return 'Отключено';
    }

    const dayLabels = schedule.days
      .map(day => weekDays.find(d => d.value === day)?.label)
      .filter(Boolean)
      .join(', ');

    return `${dayLabels} в ${schedule.time}`;
  };

  if (loading) {
    return (
      <Container>
        <Typography>Загрузка...</Typography>
      </Container>
    );
  }

  return (
    <Container>
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h4">Каналы продаж</Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => handleOpenDialog()}
        >
          Добавить канал
        </Button>
      </Box>

      <Paper>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Название</TableCell>
                <TableCell>Тип</TableCell>
                <TableCell>Источник</TableCell>
                <TableCell>Склад по умолчанию</TableCell>
                <TableCell>Расписание закупок</TableCell>
                <TableCell align="center">Автоподтверждение</TableCell>
                <TableCell align="center">Статус</TableCell>
                <TableCell align="center">Действия</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {channels.map((channel) => (
                <TableRow key={channel.id}>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      {getChannelIcon(channel.type)}
                      {channel.name}
                    </Box>
                  </TableCell>
                  <TableCell>
                    {channelTypes.find(t => t.value === channel.type)?.label}
                  </TableCell>
                  <TableCell>{getSourceName(channel)}</TableCell>
                  <TableCell>{getWarehouseName(channel.default_warehouse_id)}</TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <ScheduleIcon fontSize="small" color="action" />
                      {formatSchedule(channel.procurement_schedule)}
                    </Box>
                  </TableCell>
                  <TableCell align="center">
                    {channel.auto_confirm_orders ? (
                      <CheckCircleIcon color="success" />
                    ) : (
                      <CancelIcon color="action" />
                    )}
                  </TableCell>
                  <TableCell align="center">
                    <Chip
                      label={channel.is_active ? 'Активен' : 'Неактивен'}
                      color={channel.is_active ? 'success' : 'default'}
                      size="small"
                    />
                  </TableCell>
                  <TableCell align="center">
                    <IconButton
                      size="small"
                      onClick={() => handleOpenDialog(channel)}
                    >
                      <EditIcon />
                    </IconButton>
                    <IconButton
                      size="small"
                      color="error"
                      onClick={() => {
                        setSelectedChannel(channel);
                        setDeleteDialogOpen(true);
                      }}
                    >
                      <DeleteIcon />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
              {channels.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} align="center">
                    <Typography variant="body2" color="textSecondary">
                      Нет каналов продаж
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* Диалог создания/редактирования */}
      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="md" fullWidth>
        <DialogTitle>
          {selectedChannel ? 'Редактировать канал продаж' : 'Добавить канал продаж'}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Название"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                required
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Тип канала</InputLabel>
                <Select
                  name="type"
                  value={formData.type}
                  onChange={handleInputChange}
                  label="Тип канала"
                >
                  {channelTypes.map(type => (
                    <MenuItem key={type.value} value={type.value}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {type.icon}
                        {type.label}
                      </Box>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            {formData.type === 'marketplace' && (
              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel>Маркетплейс</InputLabel>
                  <Select
                    name="source_id"
                    value={formData.source_id}
                    onChange={handleInputChange}
                    label="Маркетплейс"
                  >
                    <MenuItem value="">
                      <em>Не выбран</em>
                    </MenuItem>
                    {marketplaces.map(mp => (
                      <MenuItem key={mp.id} value={mp.id}>
                        {mp.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
            )}

            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Склад по умолчанию</InputLabel>
                <Select
                  name="default_warehouse_id"
                  value={formData.default_warehouse_id}
                  onChange={handleInputChange}
                  label="Склад по умолчанию"
                >
                  <MenuItem value="">
                    <em>Не выбран</em>
                  </MenuItem>
                  {warehouses.map(warehouse => (
                    <MenuItem key={warehouse.id} value={warehouse.id}>
                      {warehouse.name}
                    </MenuItem>
                  ))}
                </Select>
                <FormHelperText>
                  Заказы будут автоматически привязываться к этому складу
                </FormHelperText>
              </FormControl>
            </Grid>

            <Grid item xs={12}>
              <Divider sx={{ my: 2 }} />
              <Typography variant="h6" gutterBottom>
                Настройки автоматизации
              </Typography>
            </Grid>

            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    name="auto_confirm_orders"
                    checked={formData.auto_confirm_orders}
                    onChange={handleInputChange}
                  />
                }
                label="Автоматическое подтверждение заказов"
              />
              <FormHelperText>
                Заказы будут автоматически переводиться в статус "Подтвержден"
              </FormHelperText>
            </Grid>

            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={formData.procurement_schedule.enabled}
                    onChange={(e) => handleScheduleChange('enabled', e.target.checked)}
                  />
                }
                label="Включить расписание автоматических закупок"
              />
            </Grid>

            {formData.procurement_schedule.enabled && (
              <>
                <Grid item xs={12}>
                  <Typography variant="body2" color="textSecondary" gutterBottom>
                    Выберите дни недели для автоматических закупок:
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                    {weekDays.map(day => (
                      <Chip
                        key={day.value}
                        label={day.label}
                        onClick={() => handleDayToggle(day.value)}
                        color={formData.procurement_schedule.days.includes(day.value) ? 'primary' : 'default'}
                        variant={formData.procurement_schedule.days.includes(day.value) ? 'filled' : 'outlined'}
                      />
                    ))}
                  </Box>
                </Grid>

                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Время запуска"
                    type="time"
                    value={formData.procurement_schedule.time}
                    onChange={(e) => handleScheduleChange('time', e.target.value)}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
              </>
            )}

            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    name="is_active"
                    checked={formData.is_active}
                    onChange={handleInputChange}
                  />
                }
                label="Канал активен"
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Отмена</Button>
          <Button onClick={handleSubmit} variant="contained">
            {selectedChannel ? 'Сохранить' : 'Создать'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Диалог подтверждения удаления */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Подтверждение удаления</DialogTitle>
        <DialogContent>
          <Typography>
            Вы уверены, что хотите удалить канал продаж "{selectedChannel?.name}"?
          </Typography>
          <Alert severity="warning" sx={{ mt: 2 }}>
            Все заказы, связанные с этим каналом, останутся в системе, но не будут
            привязаны к каналу продаж.
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Отмена</Button>
          <Button onClick={handleDelete} color="error" variant="contained">
            Удалить
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default SalesChannels;
